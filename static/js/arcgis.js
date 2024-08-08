const app = require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/MapImageLayer",
  "esri/layers/FeatureLayer",
], (Map, MapView, MapImageLayer, FeatureLayer) => {
  'use strict'
  //////////////////////////////////////////////////////////////////////// State Variables
  const REST_ENDPOINT = 'https://geoglows.ecmwf.int/api/v2'
  const ESRI_LAYER_URL = 'https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'
  const LOADING_GIF = 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif'
  const OSM_REGIONS_URL = 'https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/OSM_Regions_view/FeatureServer'
  const OSM_WATERWAYS_NA = 'https://services6.arcgis.com/Do88DoK2xjTUCXd1/arcgis/rest/services/OSM_NA_Waterways/FeatureServer'
  const OSM_WATERWAYS_CA = 'https://services6.arcgis.com/Do88DoK2xjTUCXd1/arcgis/rest/services/OSM_CA_Waterways/FeatureServer'
  const OSM_WATERWAYS_SA = 'https://services6.arcgis.com/Do88DoK2xjTUCXd1/arcgis/rest/services/OSM_SA_Waterways/FeatureServer'
  const OSM_WATERWAYS_EU = 'https://services-eu1.arcgis.com/zci5bUiJ8olAal7N/arcgis/rest/services/OpenStreetMap_Waterways_for_Europe/FeatureServer'
  const OSM_WATERWAYS_AF = 'https://services-eu1.arcgis.com/zci5bUiJ8olAal7N/arcgis/rest/services/OSM_AF_Waterways/FeatureServer'
  const OSM_WATERWAYS_AS = 'https://services-ap1.arcgis.com/iA7fZQOnjY9D67Zx/arcgis/rest/services/OSM_AS_Waterways/FeatureServer'
  const OSM_WATERWAYS_AU = 'https://services-ap1.arcgis.com/iA7fZQOnjY9D67Zx/arcgis/rest/services/OSM_AU_Waterways/FeatureServer'

  //////////////////////////////////////////////////////////////////////// Element Selectors
  const checkboxLoadForecast = document.getElementById('auto-load-forecasts')
  const checkboxLoadRetro = document.getElementById('auto-load-retrospective')
  const checkboxUseLocalTime = document.getElementById('use-local-time')
  const inputForecastDate = document.getElementById('forecast-date-calendar')

  const modalCharts = document.getElementById("charts-modal")
  const chartForecast = document.getElementById("forecastPlot")
  const chartRetro = document.getElementById("retroPlot")

  const playButton = document.getElementById('animationPlay')
  const stopButton = document.getElementById('animationStop')
  const plus1Button = document.getElementById('animationPlus1')
  const back1Button = document.getElementById('animationBack1')
  const slider = document.getElementById('time-slider')
  const currentDate = document.getElementById("current-map-date")

  //////////////////////////////////////////////////////////////////////// Materialize Initialization
  M.AutoInit()

  //////////////////////////////////////////////////////////////////////// Set Date Conditions for Data and Maps
  let now = new Date()
  now.setHours(now.getHours() - 12)
  inputForecastDate.max = now.toISOString().split("T")[0]
  inputForecastDate.value = now.toISOString().split("T")[0]
  now.setHours(now.getHours() - 59 * 24)
  inputForecastDate.min = now.toISOString().split("T")[0]

  //////////////////////////////////////////////////////////////////////// Manipulate Default Controls and DOM Elements
  let loadingStatus = {reachid: "clear", forecast: "clear", retro: "clear"}
  let REACHID
  const MIN_QUERY_ZOOM = 12

  ////////////////////////////////////////////////////////////////////////  Create Layer, Map, View
  const layer = new MapImageLayer({
    url: ESRI_LAYER_URL,
    sublayers: [
      {
        id: 0,
        visible: true,
        // definitionExpression: "pop2000 > 100000"
      }
    ]
  })
  const regionsLayer = new FeatureLayer({url: OSM_REGIONS_URL})
  // const naWaterwaysLayer = new FeatureLayer({url: OSM_WATERWAYS_NA})
  // const caWaterwaysLayer = new FeatureLayer({url: OSM_WATERWAYS_CA})
  // const saWaterwaysLayer = new FeatureLayer({url: OSM_WATERWAYS_SA})
  // const euWaterwaysLayer = new FeatureLayer({url: OSM_WATERWAYS_EU})
  // const afWaterwaysLayer = new FeatureLayer({url: OSM_WATERWAYS_AF})
  // const asWaterwaysLayer = new FeatureLayer({url: OSM_WATERWAYS_AS})
  // const auWaterwaysLayer = new FeatureLayer({url: OSM_WATERWAYS_AU})
  const waterwaysLayers = {
    'north-america': new FeatureLayer({url: OSM_WATERWAYS_NA}),
    'central-america': new FeatureLayer({url: OSM_WATERWAYS_CA}),
    'south-america': new FeatureLayer({url: OSM_WATERWAYS_SA}),
    'europe': new FeatureLayer({url: OSM_WATERWAYS_EU}),
    'africa': new FeatureLayer({url: OSM_WATERWAYS_AF}),
    'asia': new FeatureLayer({url: OSM_WATERWAYS_AS}),
    'australia': new FeatureLayer({url: OSM_WATERWAYS_AU}),
  }

  const map = new Map({
    basemap: "dark-gray-vector",
    layers: [layer],
    spatialReference: {wkid: 102100}
  })
  const view = new MapView({
    container: "map",
    map: map,
    zoom: 4,
    center: [-99, 39]
  })

  const queryLayerForID = event => {
    // query the regions with the geometry of the click event and log the response
    regionsLayer
      .queryFeatures({
        geometry: event.mapPoint,
        spatialRelationship: "intersects",
        outFields: ["*"],
      })
      .then(response => {
        console.log(response)
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
            console.log(response)
            // put it in the div for the opened modal
            const name = response?.features[0]?.attributes?.name || "Unknown Name"
            document.getElementById("river-name").innerHTML = `: ${name}`
          })
      })

    const queryParameters = {
      geometry: event.mapPoint,
      distance: 125,
      units: "meters",
      spatialRelationship: "intersects",
      outFields: ["*"],
      returnGeometry: true
    }
    layer
      .findSublayerById(0)
      .queryFeatures(queryParameters)
      .then(response => {
        console.log(response);
        if (!response.features.length) {
          M.toast({html: "No river segment found. Zoom in and be precise when selecting rivers.", classes: "red"})
          return
        }
        REACHID = response.features[0].attributes.comid
        if (REACHID === "Null" || !REACHID) {
          updateStatusIcons({reachid: "fail"})
          M.toast({html: "River not found. Try to zoom in and be precise when clicking the stream.", classes: "red", displayDuration: 5000})
          console.error(error)
          return
        }

        // delete previous graphics then add the new one
        view.graphics.removeAll()
        view.graphics.add({
          geometry: response.features[0].geometry,
          symbol: {
            type: "simple-line",
            color: [0, 0, 255],
            width: 3
          }
        })
        fetchData(REACHID)
      })
  }

  ////////////////////////////////////////////////////////////////////////  Animation Controls
  const getDateAsString = date => {
    if (checkboxUseLocalTime.checked) return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") + " " + String(date.getHours()).padStart(2, "0") + ":00:00" + " Local Time"
    return currentDate.innerHTML = mapTime.toISOString().replaceAll("T", " ").replace("Z", "").replace(".000", "") + " UTC"
  }
  let mapTime = new Date()
  mapTime = new Date(mapTime.toISOString())
  mapTime.setUTCHours(0)
  mapTime.setUTCMinutes(0)
  mapTime.setUTCSeconds(0)
  mapTime.setUTCMilliseconds(0)
  const animationDays = 10  // 15 days
  const stepsPerDay = 8  // 3 hour steps
  const numAnimateSteps = animationDays * stepsPerDay
  const startDateTime = new Date(mapTime)
  const endDateTime = new Date(mapTime.setUTCHours(animationDays * 24))
  let animate = false
  let animateSpeed = 750
  mapTime = new Date(startDateTime)
  currentDate.innerHTML = getDateAsString(mapTime)
  const refreshLayerAnimation = () => {
    mapTime = new Date(startDateTime)
    mapTime.setUTCHours(slider.value * 3)
    currentDate.innerHTML = getDateAsString(mapTime)
    esriStreamLayer.setTimeRange(mapTime, endDateTime)
  }
  const playAnimation = (once = false) => {
    if (!animate) return
    animate = !once  // toggle animation if play once (once =true, animate = false)
    mapTime < endDateTime ? slider.value = Number(slider.value) + 1 : slider.value = 0
    refreshLayerAnimation()
    setTimeout(playAnimation, animateSpeed)
  }
  playButton.addEventListener("click", () => {
    animate = true
    playAnimation()
  })
  stopButton.addEventListener("click", () => animate = false)
  plus1Button.addEventListener("click", () => {
    animate = true
    playAnimation(true)
  })
  back1Button.addEventListener("click", () => {
    mapTime > startDateTime ? slider.value = Number(slider.value) - 1 : slider.value = numAnimateSteps
    refreshLayerAnimation()
  })
  slider.addEventListener("change", _ => refreshLayerAnimation())

  //////////////////////////////////////////////////////////////////////// OTHER UTILITIES ON THE LEFT COLUMN
  const fetchData = reachid => {
    REACHID = reachid ? reachid : REACHID
    if (!REACHID) return updateStatusIcons({reachid: "fail"})
    M.Modal.getInstance(modalCharts).open()
    updateStatusIcons({reachid: "ready", forecast: "clear", retro: "clear"})
    clearChartDivs()
    checkboxLoadForecast.checked ? getForecastData() : giveForecastRetryButton(REACHID)
    checkboxLoadRetro.checked ? getRetrospectiveData() : giveRetrospectiveRetryButton(REACHID)
  }

  const setReachID = () => {
    REACHID = prompt("Please enter a 9 digit River ID to search for.")
    if (!REACHID) return
    if (!/^\d{9}$/.test(REACHID)) return alert("River ID numbers should be 9 digit numbers") // check that it is a 9 digit number
    fetchData(parseInt(REACHID))
  }

//////////////////////////////////////////////////////////////////////// UPDATE DOWNLOAD LINKS FUNCTION
  const updateDownloadLinks = type => {
    if (type === "clear") {
      document.getElementById("download-forecast-btn").href = ""
      document.getElementById("download-historical-btn").href = ""
    } else if (type === "set") {
      document.getElementById("download-forecast-btn").href = `${REST_ENDPOINT}/forecast/${REACHID}`
      document.getElementById("download-historical-btn").href = `${REST_ENDPOINT}/retrospective/${REACHID}`
    }
  }

////////////////////////////////////////////////////////////////////////  GET DATA FROM API AND MANAGING PLOTS
  const getForecastData = reachID => {
    REACHID = reachID ? reachID : REACHID
    if (!REACHID) return
    chartForecast.innerHTML = `<img alt="loading signal" src=${LOADING_GIF}>`
    updateStatusIcons({forecast: "load"})
    fetch(
      `${REST_ENDPOINT}/forecast/${REACHID}/?format=json&date=${inputForecastDate.value.replaceAll("-", "")}`
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
              name: 'Uncertainty',
              fill: 'toself',
              fillcolor: 'rgba(44,182,255,0.6)',
              line: {color: 'rgba(0,0,0,0)'}
            },
            {
              x: response.datetime,
              y: response.flow_uncertainty_lower,
              name: 'Uncertainty Lower',
              line: {color: 'rgb(0,166,255)'},
              showlegend: false,
            },
            {
              x: response.datetime,
              y: response.flow_uncertainty_upper,
              name: 'Uncertainty Upper',
              line: {color: 'rgb(0,166,255)'},
              showlegend: false,
            },
            {
              x: response.datetime,
              y: response.flow_median,
              name: 'Predicted Flow',
              line: {color: 'black'}
            },
          ],
          {
            title: `River Forecast for ${REACHID}`,
            xaxis: {title: "Date (UTC +00:00)"},
            yaxis: {title: "Discharge (m³/s)"},
          }
        )
        updateDownloadLinks("set")
        updateStatusIcons({forecast: "ready"})
      })
      .catch(response => {
        updateStatusIcons({forecast: "fail"})
        giveForecastRetryButton(REACHID)
      })
  }

  const getRetrospectiveData = () => {
    if (!REACHID) return
    updateStatusIcons({retro: "load"})
    updateDownloadLinks("clear")
    chartRetro.innerHTML = `<img alt="loading signal" src=${LOADING_GIF}>`
    const defaultDateRange = ['2015-01-01', new Date().toISOString().split("T")[0]]
    fetch(
      `${REST_ENDPOINT}/retrospective/${REACHID}/?format=json`
    )
      .then(response => response.json())
      .then(response => {
        chartRetro.innerHTML = ``
        Plotly.newPlot(
          chartRetro,
          [
            {
              x: response.datetime,
              y: response[REACHID],
            }
          ],
          {
            title: `Simulated River Flow for ${REACHID}`,
            yaxis: {title: "Discharge (m³/s)"},
            xaxis: {
              title: "Date (UTC +00:00)",
              autorange: false,
              range: defaultDateRange,
              rangeslider: {},
              rangeselector: {
                buttons: [
                  {
                    count: 1,
                    label: '1 year',
                    step: 'year',
                    stepmode: 'backward'
                  },
                  {
                    count: 5,
                    label: '5 years',
                    step: 'year',
                    stepmode: 'backward'
                  },
                  {
                    count: 10,
                    label: '10 years',
                    step: 'year',
                    stepmode: 'backward'
                  },
                  {
                    label: 'All',
                    step: 'All',
                  }
                ]
              },
              type: 'date'
            }
          }
        )
        updateDownloadLinks("set")
        updateStatusIcons({retro: "ready"})
      })
      .catch(() => {
        updateStatusIcons({retro: "fail"})
        giveRetrospectiveRetryButton(REACHID)
      })
  }

//////////////////////////////////////////////////////////////////////// Update
  const updateStatusIcons = status => {
    for (let key in status) {
      loadingStatus[key] = status[key]
    }
    document.getElementById("request-status").innerHTML = [
      ['reachid', 'River ID'],
      ['forecast', 'Forecast'],
      ['retro', 'Retrospective']
    ].map(key => {
      let message
      switch (loadingStatus[key[0]]) {
        case "load":
          message = key[0] === "reachid" ? "Identifying" : "Loading"
          break
        case "ready":
          message = key[0] === "reachid" ? REACHID : "Ready"
          break
        case "fail":
          message = "Failed"
          break
        case "clear":
          message = "none"
      }
      return `<span class="status-${loadingStatus[key[0]]}">${key[1]}: ${message}</span>`
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

  const giveForecastRetryButton = reachid => {
    clearChartDivs({chartTypes: "forecast"})
    chartForecast.innerHTML = `<button class="btn btn-warning" onclick="app.getForecastData(${reachid})">Retrieve Forecast Data</button>`
  }
  const giveRetrospectiveRetryButton = reachid => {
    clearChartDivs({chartTypes: "historical"})
    chartRetro.innerHTML = `<button class="btn btn-warning" onclick="app.getRetrospectiveData(${reachid})">Retrieve Retrospective Data</button>`
  }

//////////////////////////////////////////////////////////////////////// Event Listeners
  inputForecastDate.addEventListener("change", () => getForecastData())
  checkboxUseLocalTime.addEventListener("change", () => currentDate.innerHTML = getDateAsString(mapTime))

  view.on("click", event => {
    if (view.zoom < MIN_QUERY_ZOOM) return view.goTo({target: event.mapPoint, zoom: MIN_QUERY_ZOOM});
    M.toast({html: "Identifying river segment. Charts will load soon.", classes: "orange"})
    updateStatusIcons({reachid: "load", forecast: "clear", retro: "clear"})
    queryLayerForID(event)
  })

  return {
    getForecastData,
    getRetrospectiveData,
    setReachID,
  }
})()


// const app = (() => {
//   'use strict'
//   //////////////////////////////////////////////////////////////////////// Add legend and lat/lon box
//   let latlon = L.control({position: "bottomleft"})
//   latlon.onAdd = () => {
//     let div = L.DomUtil.create("div")
//     div.innerHTML = '<div id="mouse-position" class="map-overlay-element"></div>'
//     return div
//   }
//   latlon.addTo(m)
//   m.on("mousemove", event => document.getElementById("mouse-position").innerHTML = `Lat: ${event.latlng.lat.toFixed(3)}, Lon: ${event.latlng.lng.toFixed(3)}`)
//   let legend = L.control({position: "bottomright"})
//   legend.onAdd = () => {
//     let div = L.DomUtil.create("div", "legend")
//     const legendEntries = [
//       ["purple", "20+ year Flow"],
//       ["red", "10+ year Flow"],
//       ["gold", "2+ yearFlow"],
//       ["blue", "Streams"]
//     ]
//     const polyLineSVG = (color, label) => `<div><svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline points="19 1, 1 6, 19 14, 1 19" stroke="${color}" fill="transparent" stroke-width="2"/></svg>${label}</div>`
//     div.innerHTML = '<div class="legend">' + legendEntries.map(entry => polyLineSVG(...entry)).join("") + "</div>"
//     return div
//   }
//   legend.addTo(m)
//
//
// })