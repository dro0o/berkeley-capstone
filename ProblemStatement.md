# California Wildfire Modeling

## Research Question

Can wildfire risk in California be accurately predicted at a spatial grid-cell level using historical environmental, geographic, and human activity data?

## Expected Data Sources

Data will be sourced primarily through Google Earth Engine, including:

- Satellite-derived environmental data (temperature, humidity, precipitation, wind)
- Vegetation indices (e.g., NDVI)
- Elevation and slope from terrain models
- Historical wildfire occurrence and perimeter datasets (e.g., MODIS fire products)
- Population density and infrastructure proximity (for human ignition risk)

These datasets will be used to construct spatial-temporal features such as rolling weather averages, vegetation dryness indicators, and historical fire frequency within neighboring grid cells.

## Techniques

The analysis will begin with multiple linear regression as a baseline model. Because wildfire risk is driven by nonlinear interactions between environmental and geographic variables, additional models and analysis may include:

- Tree-based models (Random Forest, Gradient Boosting)
- Logistic regression (for binary fire occurrence classification)
- Principal Component Analysis (PCA) to reduce multicollinearity
- Spatial and temporal feature engineering (lag variables, neighborhood effects)

Model evaluation will use time-based train/test splits to reflect real-world forecasting conditions and prevent data leakage.

## Expected Results

The project is expected to produce:

- A predictive model that outputs wildfire risk scores per grid cell and time period
- Identification of key contributing variables (e.g., temperature, vegetation dryness, wind)
- Quantitative evaluation of model performance using standard classification metrics
- Spatial risk maps that highlight high-risk regions ahead of fire events

## Analysis Importance

Wildfires in California cause billions in economic damage, threaten lives, and strain emergency response systems. Current response strategies are often reactive rather than predictive.

Accurate, localized wildfire risk prediction enables agencies to act proactively by:

- Pre-position firefighting resources in high-risk areas
- Prioritize vegetation management and controlled burns
- Issue earlier warnings to at-risk communities
- Optimize budget allocation based on quantified risk

Without predictive insight, resource allocation will continue to rely heavily on historical patterns and reactive deployment, increasing the likelihood of delayed response and preventable damage. This analysis provides a data-driven foundation for proactive wildfire management, improving both public safety and cost efficiency.
