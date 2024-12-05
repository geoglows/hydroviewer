require([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/layers/MapImageLayer",
  "esri/layers/ImageryLayer",
  "esri/layers/TileLayer",
  "esri/layers/WebTileLayer",
  "esri/layers/FeatureLayer",
  "esri/widgets/Home",
  "esri/widgets/BasemapGallery",
  "esri/widgets/ScaleBar",
  "esri/widgets/Legend",
  "esri/widgets/Expand",
  "esri/widgets/LayerList",
  "esri/intl",
], (WebMap, MapView, MapImageLayer, ImageryLayer, TileLayer, WebTileLayer, FeatureLayer, Home, BasemapGallery, ScaleBar, Legend, Expand, LayerList, intl) => {
  'use strict'

//////////////////////////////////////////////////////////////////////// Constants Variables
  const REST_ENDPOINT = 'https://geoglows.ecmwf.int/api/v2'

  const ESRI_LAYER_URL = 'https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'
  const OSM_REGIONS_URL = 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/OSM_Regions_view/FeatureServer'
  const OSM_WATERWAYS_NA = 'https://services6.arcgis.com/Do88DoK2xjTUCXd1/arcgis/rest/services/OSM_NA_Waterways/FeatureServer'
  const OSM_WATERWAYS_CA = 'https://services6.arcgis.com/Do88DoK2xjTUCXd1/arcgis/rest/services/OSM_CA_Waterways/FeatureServer'
  const OSM_WATERWAYS_SA = 'https://services6.arcgis.com/Do88DoK2xjTUCXd1/arcgis/rest/services/OSM_SA_Waterways/FeatureServer'
  const OSM_WATERWAYS_EU = 'https://services-eu1.arcgis.com/zci5bUiJ8olAal7N/arcgis/rest/services/OpenStreetMap_Waterways_for_Europe/FeatureServer'
  const OSM_WATERWAYS_AF = 'https://services-eu1.arcgis.com/zci5bUiJ8olAal7N/arcgis/rest/services/OSM_AF_Waterways/FeatureServer'
  const OSM_WATERWAYS_AS = 'https://services-ap1.arcgis.com/iA7fZQOnjY9D67Zx/arcgis/rest/services/OSM_AS_Waterways/FeatureServer'
  const OSM_WATERWAYS_AU = 'https://services-ap1.arcgis.com/iA7fZQOnjY9D67Zx/arcgis/rest/services/OSM_AU_Waterways/FeatureServer'

  const MIN_QUERY_ZOOM = 11
  const LOADING_GIF = '../static/img/loading.gif'
  const riverCountriesJSON = '../static/json/riverCountries.json'
  const outletCountriesJSON = '../static/json/outletCountries.json'
  const vpuListJSON = '../static/json/vpuList.json'

  // parse language from the url path
  const lang = (window.location.pathname.split("/").filter(x => x && !x.includes(".html") && !x.includes('viewer'))[0] || 'en-US');
  Plotly.setPlotConfig({'locale': lang})
  intl.setLocale(lang)

  // parse initial state from the hash
  const hashParams = new URLSearchParams(window.location.hash.slice(1))
  let lon = !isNaN(parseFloat(hashParams.get('lon'))) ? parseFloat(hashParams.get('lon')) : 10
  let lat = !isNaN(parseFloat(hashParams.get('lat'))) ? parseFloat(hashParams.get('lat')) : 18
  let zoom = !isNaN(parseFloat(hashParams.get('zoom'))) ? parseFloat(hashParams.get('zoom')) : 2.75
  const initialState = {
    lon: lon,
    lat: lat,
    zoom: zoom,
    definition: hashParams.get('definition') || "",
  }

//////////////////////////////////////////////////////////////////////// Element Selectors
  const checkboxLoadForecast = document.getElementById('auto-load-forecasts')
  const checkboxLoadRetro = document.getElementById('auto-load-retrospective')
  const inputForecastDate = document.getElementById('forecast-date-calendar')
  const riverName = document.getElementById('river-name')
  const selectRiverCountry = document.getElementById('riverCountry')
  const selectOutletCountry = document.getElementById('outletCountry')
  const selectVPU = document.getElementById('vpuSelect')
  const definitionString = document.getElementById("definitionString")
  const definitionDiv = document.getElementById("definition-expression")
  const modalCharts = document.getElementById("charts-modal")
  const modalFilter = document.getElementById("filter-modal")
  const chartForecast = document.getElementById("forecastPlot")
  const chartRetro = document.getElementById("retroPlot")

//////////////////////////////////////////////////////////////////////// Manipulate Default Controls and DOM Elements
  let loadingStatus = {riverid: "clear", forecast: "clear", retro: "clear"}
  let riverId
  let definitionExpression = ""

// set the default date to 12 hours before now UTC time
  const now = new Date()
  now.setHours(now.getHours() - 12)
  inputForecastDate.value = now.toISOString().split("T")[0]

  fetch(riverCountriesJSON)
    .then(response => response.json())
    .then(response => {
        selectRiverCountry.innerHTML += response.map(c => `<option value="${c}">${c}</option>`).join('')
        M.FormSelect.init(selectRiverCountry)
      }
    )
  fetch(outletCountriesJSON)
    .then(response => response.json())
    .then(response => {
        selectOutletCountry.innerHTML += response.map(c => `<option value="${c}">${c}</option>`).join('')
        M.FormSelect.init(selectOutletCountry)
      }
    )
  fetch(vpuListJSON)
    .then(response => response.json())
    .then(response => {
        selectVPU.innerHTML += response.map(v => `<option value="${v}">${v}</option>`).join('')
        M.FormSelect.init(selectVPU)
      }
    )

////////////////////////////////////////////////////////////////////////  Create Layer, Map, View
  const rfsLayer = new MapImageLayer({
    url: ESRI_LAYER_URL,
    title: "GEOGLOWS River Forecast System v2",
    sublayers: [{
      id: 0,
      definitionExpression: definitionExpression,
    }]
  })

  const viirsFloodClassified = new WebTileLayer({
    urlTemplate: "https://floods.ssec.wisc.edu/tiles/RIVER-FLDglobal-composite/{level}/{col}/{row}.png",
    title: "NOAA-20 VIIRS Flood Composite",
    copyright: "University of Wisconsin-Madison SSEC",
    visible: false,
  });
  const viirsTrueColor = new ImageryLayer({
    portalItem: {id: "c873f4c13aa54b25b01270df9358dc64"},
    title: "NOAA-20 VIIRS True Color Corrected Reflectance",
    visible: false,
  })
  const viirsWaterStates = new ImageryLayer({
    portalItem: {id: "3695712d28354952923d2a26a176b767"},
    title: "NOAA-20 VIIRS Water States",
    visible: false,
  })
  const viirsThermalAnomalies = new FeatureLayer({
    portalItem: {id: "dece90af1a0242dcbf0ca36d30276aa3"},
    title: "NOAA-20 VIIRS Thermal Anomalies",
    visible: false,
  })
  const goesImageryColorized = new TileLayer({
    portalItem: {id: "37a875ff3611496883b7ccca97f0f5f4"},
    title: "GOES Weather Satellite Colorized Infrared Imagery",
    visible: false,
  })

  const regionsLayer = new FeatureLayer({url: OSM_REGIONS_URL})
  const waterwaysLayers = {
    'north-america': new FeatureLayer({url: OSM_WATERWAYS_NA}),
    'central-america': new FeatureLayer({url: OSM_WATERWAYS_CA}),
    'south-america': new FeatureLayer({url: OSM_WATERWAYS_SA}),
    'europe': new FeatureLayer({url: OSM_WATERWAYS_EU}),
    'africa': new FeatureLayer({url: OSM_WATERWAYS_AF}),
    'asia': new FeatureLayer({url: OSM_WATERWAYS_AS}),
    'australia': new FeatureLayer({url: OSM_WATERWAYS_AU}),
  }

  const map = new WebMap({
    portalItem: {id: "a69f14ea2e784e019f4a4b6835ffd376"},
    title: "Environment Basemap",
    spatialReference: {wkid: 102100},
    legendEnabled: true,
  })
  const view = new MapView({
    container: "map",
    map: map,
    zoom: initialState.zoom,
    center: [initialState.lon, initialState.lat],
    constraints: {
      rotationEnabled: false,
      snapToZoom: false,
      minZoom: 0,
    },
  })
  const homeBtn = new Home({
    view: view
  })
  const scaleBar = new ScaleBar({
    view: view,
    unit: "dual"
  })
  const legend = new Legend({
    view: view
  })
  const legendExpand = new Expand({
    view: view,
    content: legend,
    expandTooltip: text.tooltips.legend,
    expanded: false
  })
  const basemapGallery = new BasemapGallery({
    view: view
  })
  const basemapExpand = new Expand({
    view: view,
    content: basemapGallery,
    expandTooltip: text.tooltips.basemap,
    expanded: false
  })
  const layerList = new LayerList({
    view: view
  })
  const layerListExpand = new Expand({
    view: view,
    content: layerList,
    expandTooltip: text.tooltips.layerList,
    expanded: false
  })

  const filterButton = document.createElement('div');
  filterButton.className = "esri-widget--button esri-widget esri-interactive";
  filterButton.innerHTML = `<span class="esri-icon-filter"></span>`;
  filterButton.addEventListener('click', () => M.Modal.getInstance(modalFilter).open());

  view.ui.add(homeBtn, "top-left");
  view.ui.add(layerListExpand, "top-right")
  view.ui.add(basemapExpand, "top-right")
  view.ui.add(filterButton, "top-left");
  view.ui.add(scaleBar, "bottom-right");
  view.ui.add(legendExpand, "bottom-left");
  view.navigation.browserTouchPanEnabled = true;
  view.when(() => {
    map.layers.add(viirsFloodClassified)
    map.layers.add(goesImageryColorized)
    map.layers.add(viirsThermalAnomalies)
    map.layers.add(viirsWaterStates)
    map.layers.add(viirsTrueColor)
    map.layers.add(rfsLayer)
  })  // layers should be added to webmaps after the view is ready

  const queryLayerForName = event => {
    regionsLayer
      .queryFeatures({
        geometry: event.mapPoint,
        spatialRelationship: "intersects",
        outFields: ["*"],
      })
      .then(response => {
        waterwaysLayers
          [response.features[0].attributes.Name]
          .queryFeatures({
            geometry: event.mapPoint,
            distance: 125,
            units: "meters",
            spatialRelationship: "intersects",
            outFields: ["*"],
            returnGeometry: true
          })
          .then(response => {
            const name = response?.features[0]?.attributes?.name || text.status.unknown
            riverName.innerHTML = `: ${name}`
          })
      })
  }
  const queryLayerForID = event => {
    layer
      .findSublayerById(0)
      .queryFeatures({
        geometry: event.mapPoint,
        distance: 125,
        units: "meters",
        spatialRelationship: "intersects",
        outFields: ["*"],
        returnGeometry: true,
        definitionExpression: definitionExpression,
      })
      .then(response => {
        if (!response.features.length) {
          M.toast({html: text.prompts.tryRiverAgain, classes: "red", displayDuration: 5000})
          return
        }
        riverId = response.features[0].attributes.comid
        if (riverId === "Null" || !riverId) {
          updateStatusIcons({riverid: "fail"})
          M.toast({html: text.prompts.tryRiverAgain, classes: "red", displayDuration: 5000})
          console.error(error)
          return
        }
        view.graphics.removeAll()
        view.graphics.add({
          geometry: response.features[0].geometry,
          symbol: {
            type: "simple-line",
            color: [0, 0, 255],
            width: 3
          }
        })
        fetchData(riverId)
      })
  }
  const buildDefinitionExpression = () => {
    const riverCountry = M.FormSelect.getInstance(selectRiverCountry).getSelectedValues()
    const outletCountry = M.FormSelect.getInstance(selectOutletCountry).getSelectedValues()
    const vpu = M.FormSelect.getInstance(selectVPU).getSelectedValues()
    const customString = definitionString.value
    if (!riverCountry.length && !outletCountry.length && !vpu.length && customString === "") return M.Modal.getInstance(modalFilter).close()

    let definitions = []
    if (riverCountry.length) riverCountry.forEach(c => definitions.push(`rivercountry='${c}'`))
    if (outletCountry.length) outletCountry.forEach(c => definitions.push(`outletcountry='${c}'`))
    if (vpu.length) vpu.forEach(v => definitions.push(`vpu=${v}`))
    if (customString !== "") definitions.push(customString)
    definitionExpression = definitions.join(" OR ")
    return definitionExpression
  }
  const updateLayerDefinitions = expression => {
    expression = expression === undefined ? buildDefinitionExpression() : expression
    layer.findSublayerById(0).definitionExpression = expression
    definitionExpression = expression
    definitionDiv.value = expression
    M.Modal.getInstance(modalFilter).close()
    setHashDefinition(expression)
  }
  const resetDefinitionExpression = () => {
    // reset the selected values to All on each dropdown
    selectRiverCountry.value = ""
    selectOutletCountry.value = ""
    selectVPU.value = ""
    M.FormSelect.init(selectRiverCountry)
    M.FormSelect.init(selectOutletCountry)
    M.FormSelect.init(selectVPU)
    definitionString.value = ""
    // reset the definition expression to empty
    definitionExpression = ""
    layer.findSublayerById(0).definitionExpression = definitionExpression
    definitionDiv.value = definitionExpression
    // update the hash
    setHashDefinition(definitionExpression)
  }

//////////////////////////////////////////////////////////////////////// OTHER UTILITIES ON THE LEFT COLUMN
  const fetchData = riverid => {
    riverId = riverid ? riverid : riverId
    if (!riverId) return updateStatusIcons({riverid: "fail"})
    M.Modal.getInstance(modalCharts).open()
    updateStatusIcons({riverid: "ready", forecast: "clear", retro: "clear"})
    clearChartDivs()
    updateDownloadLinks("set")
    checkboxLoadForecast.checked ? getForecastData() : giveForecastRetryButton(riverId)
    checkboxLoadRetro.checked ? getRetrospectiveData() : giveRetrospectiveRetryButton(riverId)
  }
  const setRiverId = () => {
    riverId = prompt(text.prompts.enterRiverID)
    if (!riverId) return
    if (!/^\d{9}$/.test(riverId)) return alert(text.prompts.invalidRiverID)
    fetchData(parseInt(riverId))
  }

//////////////////////////////////////////////////////////////////////// UPDATE DOWNLOAD LINKS FUNCTION
  const updateDownloadLinks = type => {
    if (type === "clear") {
      document.getElementById("download-forecast-link").href = ""
      document.getElementById("download-retrospective-link").href = ""
      document.getElementById("download-forecast-btn").disabled = true
      document.getElementById("download-retrospective-btn").disabled = true
    } else if (type === "set") {
      document.getElementById("download-forecast-link").href = `${REST_ENDPOINT}/forecast/${riverId}`
      document.getElementById("download-retrospective-link").href = `${REST_ENDPOINT}/retrospective/${riverId}`
      document.getElementById("download-forecast-btn").disabled = false
      document.getElementById("download-retrospective-btn").disabled = false
    }
  }

//////////////////////////////////////////////////////////////////////// GET DATA FROM API AND MANAGING PLOTS
  const getForecastData = riverid => {
    riverId = riverid ? riverid : riverId
    if (!riverId) return
    chartForecast.innerHTML = `<img alt="loading signal" src=${LOADING_GIF}>`
    updateStatusIcons({forecast: "load"})
    fetch(
      `${REST_ENDPOINT}/forecast/${riverId}/?format=json&date=${inputForecastDate.value.replaceAll("-", "")}`
    )
      .then(response => response.json())
      .then(response => {
        chartForecast.innerHTML = ``
        Plotly.newPlot(
          chartForecast,
          [
            {
              x: response.datetime.concat(response.datetime.slice().toReversed()),
              y: response.flow_uncertainty_lower.concat(response.flow_uncertainty_upper.slice().toReversed()),
              name: `${text.plots.fcLineUncertainty}`,
              fill: 'toself',
              fillcolor: 'rgba(44,182,255,0.6)',
              line: {color: 'rgba(0,0,0,0)'}
            },
            {
              x: response.datetime,
              y: response.flow_uncertainty_lower,
              line: {color: 'rgb(0,166,255)'},
              showlegend: false,
            },
            {
              x: response.datetime,
              y: response.flow_uncertainty_upper,
              line: {color: 'rgb(0,166,255)'},
              showlegend: false,
            },
            {
              x: response.datetime,
              y: response.flow_median,
              name: `${text.plots.fcLineMedian}`,
              line: {color: 'black'}
            },
          ],
          {
            title: `${text.plots.fcTitle} ${riverId}`,
            xaxis: {title: `${text.plots.fcXaxis} (UTC +00:00)`},
            yaxis: {title: `${text.plots.fcYaxis} (m³/s)`},
            legend: {'orientation': 'h'},
          }
        )
        updateStatusIcons({forecast: "ready"})
      })
      .catch(response => {
        updateStatusIcons({forecast: "fail"})
        giveForecastRetryButton(riverId)
      })
  }
  const getRetrospectiveData = () => {
    if (!riverId) return
    updateStatusIcons({retro: "load"})
    chartRetro.innerHTML = `<img alt="loading signal" src=${LOADING_GIF}>`
    const defaultDateRange = ['2015-01-01', new Date().toISOString().split("T")[0]]
    fetch(
      `${REST_ENDPOINT}/retrospective/${riverId}/?format=json`
    )
      .then(response => response.json())
      .then(response => {
        chartRetro.innerHTML = ``
        Plotly.newPlot(
          chartRetro,
          [
            {
              x: response.datetime,
              y: response[riverId],
            }
          ],
          {
            title: `${text.plots.retroTitle} ${riverId}`,
            yaxis: {title: `${text.plots.retroYaxis} (m³/s)`},
            xaxis: {
              title: `${text.plots.retroXaxis} (UTC +00:00)`,
              autorange: false,
              range: defaultDateRange,
              rangeslider: {},
              rangeselector: {
                buttons: [
                  {
                    count: 1,
                    label: `1 ${text.words.year}`,
                    step: 'year',
                    stepmode: 'backward'
                  },
                  {
                    count: 5,
                    label: `5 ${text.words.years}`,
                    step: 'year',
                    stepmode: 'backward'
                  },
                  {
                    count: 10,
                    label: `10 ${text.words.years}`,
                    step: 'year',
                    stepmode: 'backward'
                  },
                  {
                    count: 30,
                    label: `30 ${text.words.years}`,
                    step: 'year',
                    stepmode: 'backward'
                  },
                  {
                    label: `${text.words.all}`,
                    count: response.datetime.length,
                    step: 'day',
                  }
                ]
              },
              type: 'date'
            }
          }
        )
        updateStatusIcons({retro: "ready"})
      })
      .catch(() => {
        updateStatusIcons({retro: "fail"})
        giveRetrospectiveRetryButton(riverId)
      })
  }

//////////////////////////////////////////////////////////////////////// Update
  const updateStatusIcons = status => {
    for (let key in status) {
      loadingStatus[key] = status[key]
    }
    document.getElementById("request-status").innerHTML = [
      'riverid', 'forecast', 'retro'
    ].map(key => {
      let message = text.status.clear
      switch (loadingStatus[key]) {
        case "load":
          message = text.status.load
          break
        case "ready":
          message = key === "riverid" ? riverId : text.status.ready
          break
        case "fail":
          message = text.status.fail
          break
      }
      return `<span class="status-${loadingStatus[key]}">${text.words[key]}: ${message}</span>`
    }).join(' - ')
  }
  const clearChartDivs = (chartTypes) => {
    if (chartTypes === "forecast" || chartTypes === null) {
      chartForecast.innerHTML = ""
    }
    if (chartTypes === "retrospective" || chartTypes === null) {
      chartRetro.innerHTML = ""
    }
  }
  const giveForecastRetryButton = riverid => {
    clearChartDivs({chartTypes: "forecast"})
    chartForecast.innerHTML = `<button class="btn btn-warning" onclick="window.getForecastData(${riverid})">${text.inputs.forecast}</button>`
  }
  const giveRetrospectiveRetryButton = riverid => {
    clearChartDivs({chartTypes: "historical"})
    chartRetro.innerHTML = `<button class="btn btn-warning" onclick="window.getRetrospectiveData(${riverid})">${text.inputs.forecast}</button>`
  }

//////////////////////////////////////////////////////////////////////// HASH UPDATES
  const updateHash = () => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    hashParams.set('lon', view.center.longitude.toFixed(2))
    hashParams.set('lat', view.center.latitude.toFixed(2))
    hashParams.set('zoom', view.zoom.toFixed(2))
    hashParams.set('definition', definitionExpression)
    window.location.hash = hashParams.toString()
  }
  const updateAppFromHash = () => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    let lon = !isNaN(parseFloat(hashParams.get('lon'))) ? parseFloat(hashParams.get('lon')) : view.center.longitude
    let lat = !isNaN(parseFloat(hashParams.get('lat'))) ? parseFloat(hashParams.get('lat')) : view.center.latitude
    let zoom = !isNaN(parseFloat(hashParams.get('zoom'))) ? parseFloat(hashParams.get('zoom')) : view.zoom
    lon = lon.toFixed(2)
    lat = lat.toFixed(2)
    zoom = zoom.toFixed(2)
    view.center = [lon, lat]
    view.zoom = zoom
    if (hashParams.get('definition') === definitionExpression) return
    updateLayerDefinitions(hashParams.get('definition'))
  }
  const setHashDefinition = definition => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    hashParams.set('definition', definition)
    window.location.hash = hashParams.toString()
  }

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
  M.AutoInit()
  if (initialState.definition) updateLayerDefinitions(initialState.definition)
  if (window.innerWidth < 800) M.toast({html: text.prompts.mobile, classes: "blue custom-toast-placement", displayLength: 8000})

//////////////////////////////////////////////////////////////////////// Event Listeners
  inputForecastDate.addEventListener("change", () => getForecastData())
  window.addEventListener('resize', () => {
    Plotly.Plots.resize(chartForecast)
    Plotly.Plots.resize(chartRetro)
  })
  view.on("click", event => {
    if (view.zoom < MIN_QUERY_ZOOM) return view.goTo({target: event.mapPoint, zoom: MIN_QUERY_ZOOM});
    M.toast({html: text.prompts.findingRiver, classes: "orange"})
    updateStatusIcons({riverid: "load", forecast: "clear", retro: "clear"})
    queryLayerForName(event)
    queryLayerForID(event)
  })
  view.watch('extent', () => updateHash())
  window.addEventListener('hashchange', () => updateAppFromHash())

//////////////////////////////////////////////////////////////////////// Export alternatives
  window.setRiverId = setRiverId
  window.getForecastData = getForecastData
  window.getRetrospectiveData = getRetrospectiveData
  window.updateLayerDefinitions = updateLayerDefinitions
  window.resetDefinitionExpression = resetDefinitionExpression
  window.layer = rfsLayer
})
