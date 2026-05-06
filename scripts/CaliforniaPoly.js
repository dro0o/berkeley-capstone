// 1. Load CA boundary from TIGER dataset
var ca = ee.FeatureCollection("TIGER/2018/States")
            .filter(ee.Filter.eq('NAME', 'California'))

// Display CA, add layer
Map.centerObject(ca, 6);
Map.addLayer(ca, {color: 'red'}, 'California Polygon')

// 2. Define Projection and Scale for the grid
// Using EPSG:3310 (California Albers) is accurate for area
var proj = ee.Projection('EPSG:3310')
var scaleMeters = 5000 // 5km grid size

// 3. Generate the covering grid
var grid = ca.geometry().coveringGrid(proj, scaleMeters)

// 4. Create simple land mask
var landMask = ee.ImageCollection("ESA/WorldCover/v100")
                  .first()
                  .eq(80)  // water = 80
                  .not()   // land = 1
                  .clip(ca)

// 5. Compute land fraction per grid cell
var gridWithLand = landMask.reduceRegions({
  collection: grid,
  reducer: ee.Reducer.mean(),
  scale: 1000,
})

// 6. Filter grid to only include cells that intersect the boundary
var spatialFilteredGrid = gridWithLand.filter(ee.Filter.gt('mean', 0.2))

// 7. Display the land grid
Map.addLayer(spatialFilteredGrid, {color: 'blue'}, '5km Grid')

// 8. Export Grid
exports.grid = spatialFilteredGrid