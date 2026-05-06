var caPoly = require('users/droo/california-wildfire-prediction:CaliforniaPoly')

// 1. Add Grid ID
var gridList = caPoly.grid.toList(caPoly.grid.size())

var caGrid = ee.FeatureCollection(
  ee.List.sequence(0, caPoly.grid.size().subtract(1))
    .map(function(i) {
      i = ee.Number(i)
      var f = ee.Feature(gridList.get(i))
      var centroid = f.geometry().centroid(1).coordinates()
      return f.set({
        'cell_id': i,
        lon: centroid.get(0),
        lat: centroid.get(1)
      })
    })
)

// 2. Init Access to datasets
// Fire (MODIS)
var fires = ee.ImageCollection('MODIS/061/MOD14A1').select('FireMask')
               
// NDVI (MODIS)
var ndvi = ee.ImageCollection('MODIS/061/MOD13A2').select('NDVI')

// ERA5-Land (multiple features)
var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/MONTHLY_AGGR')

// Human Proximity
var pop = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Density')
  .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
  .first()
  .select('population_density')
  .reproject({
    crs: caGrid.first().geometry().projection(),
    scale: 1000
  })
  .rename('pop_density')

var popVis = {
  min: 0,
  max: 1000,
  palette: ['ffffff','ffeda0','feb24c','f03b20']
}
var popSample = pop.reduceRegions({
  collection: caGrid,
  reducer: ee.Reducer.mean(),
  scale: 1000
})

var popRaster = popSample.reduceToImage({
  properties: ['mean'],
  reducer: ee.Reducer.first()
})

Map.addLayer(popRaster, popVis, 'Population Density')

// Elevation & Slope
var elevation = ee.Image('USGS/SRTMGL1_003').rename('elevation')
var slope = ee.Terrain.slope(elevation).rename('slope')

// Population ndvi interaction
var popLog = pop.add(1).log().rename('popLog')
                  
var start = ee.Date('2015-01-01')
var end = ee.Date('2024-12-31')

var months = ee.List.sequence(0, end.difference(start, 'month').subtract(1))
  .map(function(m) {
    return start.advance(m, 'month')
  })
  
// 3. Complete data pull and agg
var dataset = ee.FeatureCollection(
  months.map(function(date) {
    
    // Set active date range
    date = ee.Date(date)
    var next = date.advance(1, 'month')

    // Fire (target variable)
    var fireImage = fires
      .filterDate(date, next)
      .map(function(img) { // Convert fire mask to binary (fire vs no fire)
        return img.gte(7) // MODIS: >=7 indicates fire
      })
      .max() // Combine all days in month to max (any fire occurred)
      .rename('fire')
      
    // Fire 1 Month Lag
    var prevStart = date.advance(-1, 'month')
    var firePrev = fires
      .filterDate(prevStart, date)
      .map(function(img) {
        return img.gte(7);
      })
      .max()
      .rename('fire_last_month')
      
    // NDVI Mean (Vegetation)
    var ndviImage = ndvi
      .filterDate(date, next)
      .mean()
      .multiply(0.0001)
      .rename('ndvi')
    
    // NDVI Mean Delta 1 Month Lag
    var ndviPrev = ndvi
      .filterDate(prevStart, date)
      .mean()
      .multiply(0.0001)
    var ndviChange = ndviImage.subtract(ndviPrev).rename('ndvi_change')
      
    var eraMean = era5.filterDate(date, next).mean()
    var eraSum = era5.filterDate(date, next).sum()
    
    // Temperature Mean
    var tempImage = eraMean.select('temperature_2m').subtract(273.15).rename('temp')
    
    // Precipitation Sum
    var precipImage = eraSum.select('total_precipitation_sum').multiply(1000).rename('precip')
    
    // Precipitation Sum 3 Month Lag
    var precip3mo = era5
      .filterDate(date.advance(-3, 'month'), next)
      .sum()
      .multiply(1000)
      .select('total_precipitation_sum')
      .rename('precip_3month')
    
    // Dew
    var dewImage = eraMean.select('dewpoint_temperature_2m').subtract(273.15).rename('dew')
    
    // Wind speed
    var wind = eraMean.select(['u_component_of_wind_10m', 'v_component_of_wind_10m'])
    var windSpeed = wind.expression(
      'sqrt(u*u + v*v)', {
        'u': wind.select('u_component_of_wind_10m'),
        'v': wind.select('v_component_of_wind_10m')
      }
    ).rename('wind')
    
    // VPD (Vapor Pressure Deficit dryness)
    var es = tempImage.multiply(17.27)
      .divide(tempImage.add(237.3))
      .exp()
      .multiply(0.6108)
    
    var ea = dewImage.multiply(17.27)
      .divide(dewImage.add(237.3))
      .exp()
      .multiply(0.6108)
    
    var vpd = es.subtract(ea).rename('vpd')
    
    // Nighttime lights
    var lights = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG')
      .filterDate(date, next)
      .select('avg_rad')
      .mean()
      .rename('night_lights')
      
    // Population log ndvi interaction feature
    var popLog_ndvi = ndviImage.multiply(popLog).rename('popLog_ndvi')
      
    // Combine features
    var combined = fireImage
      .addBands(firePrev)
      .addBands(ndviImage)
      .addBands(ndviChange)
      .addBands(tempImage)
      .addBands(precipImage)
      .addBands(precip3mo)
      .addBands(windSpeed)
      .addBands(vpd)
      .addBands(elevation)
      .addBands(slope)
      .addBands(lights)
      .addBands(pop)
      .addBands(popLog)
      .addBands(popLog_ndvi)

    // Aggregate over grid
    var perCell = combined.reduceRegions({
      collection: caGrid,
      reducer: ee.Reducer.mean(),
      scale: 1000,
    })

    // Add time metadata
    return perCell.map(function(f) {
      return f.set({
        'year': date.get('year'),
        'month': date.get('month')
      })
    })

  })
).flatten()

function thousRound(x) {
  var safe = ee.Algorithms.If(ee.Algorithms.IsEqual(x, null), 0, x)
  return ee.Number(safe).multiply(1000).round().divide(1000)
}

var finalDataset = dataset.map(function(f) {
  return ee.Feature(null, {
    cell_id: f.get('cell_id'),
    year: f.get('year'),
    month: f.get('month'),
    
    fire: thousRound(f.get('fire')),
    fire_binary: ee.Number(f.get('fire')).gt(0).int(),
    fire_last_month: thousRound(f.get('fire_last_month')),
    fire_last_month_binary: ee.Number(f.get('fire_last_month')).gt(0).int(),
    
    ndvi: thousRound(f.get('ndvi')),
    ndvi_change: thousRound(f.get('ndvi_change')),
    
    temp: thousRound(f.get('temp')),
    precip: thousRound(f.get('precip')),
    precip_3month: thousRound(f.get('precip_3month')),
    wind: thousRound(f.get('wind')),
    
    vpd: thousRound(f.get('vpd')),
    
    elevation: ee.Number(f.get('elevation')).round(),
    slope: thousRound(f.get('slope')),
    lon: f.get('lon'),
    lat: f.get('lat'),
    
    pop_density: thousRound(f.get('pop_density')),
    night_lights: thousRound(f.get('night_lights')),
    
    popLog: thousRound(f.get('popLog')),
    popLog_ndvi: thousRound(f.get('popLog_ndvi'))
  })
})

// Export curated dataset
Export.table.toDrive({
  collection: finalDataset,
  description: 'wildfire_multifeature_dataset',
  fileFormat: 'CSV',
  selectors: [
    'cell_id','year','month',
    'fire','fire_binary',
    'fire_last_month','fire_last_month_binary',
    'ndvi','ndvi_change',
    'temp','precip','precip_3month','wind','vpd',
    'elevation','slope',
    'pop_density', 'night_lights',
    'popLog', 'popLog_ndvi',
    'lat','lon'
  ]
})

// Transform grid to standard lat/lon
var caGridWGS84 = caGrid.map(function(f) {
  return f.transform('EPSG:4326', 1)
          .set('cell_id', ee.Number(f.get('cell_id')).int())
          .select(['cell_id'])
})

// Export as GeoJSON
Export.table.toDrive({
  collection: caGridWGS84,
  description: 'ca_grid',
  fileFormat: 'GeoJSON'
})