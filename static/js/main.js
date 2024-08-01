const app = (() => {
  'use strict'

//////////////////////////////////////////////////////////////////////// State Variables
  ////// URLS FROM TEMPLATE RENDER
  const REST_ENDPOINT = 'https://geoglows.ecmwf.int/api/'
  const ESRI_LAYER_URL = 'https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'
  const LOADING_GIF = 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif'

//////////////////////////////////////////////////////////////////////// Manipulate Default Controls and DOM Elements
  document.getElementById("forecast_date").max = new Date().toISOString().split("T")[0]
  document.getElementById("forecast_date").value = new Date().toISOString().split("T")[0]

  let loadingStatus = {reachid: "clear", forecast: "clear", retro: "clear"}
  let REACHID
  const MIN_QUERY_ZOOM = 12
  let mapMarker = null

//////////////////////////////////////////////////////////////////////// ESRI Map
  const mapObj = L.map("map", {
    zoom: 3,
    minZoom: 2,
    maxZoom: 15,
    boxZoom: true,
    maxBounds: L.latLngBounds(L.latLng(-100, -225), L.latLng(100, 225)),
    center: [20, 0]
  })
  let selectedSegment = L.geoJSON(false, {weight: 5, color: "#00008b"}).addTo(mapObj)
  const basemapsJson = {
    "ESRI Topographic": L.esri.basemapLayer("Topographic").addTo(mapObj),
    "ESRI Terrain": L.layerGroup([
      L.esri.basemapLayer("Terrain"),
      L.esri.basemapLayer("TerrainLabels")
    ]),
    "ESRI Grey": L.esri.basemapLayer("Gray")
  }
//////////////////////////////////////////////////////////////////////// ADD LEGEND LAT LON BOX
  let latlon = L.control({position: "bottomleft"})
  latlon.onAdd = () => {
    let div = L.DomUtil.create("div")
    div.innerHTML = '<div id="mouse-position" class="map-overlay-element"></div>'
    return div
  }
  latlon.addTo(mapObj)
  mapObj.on("mousemove", event => document.getElementById("mouse-position").innerHTML = `Lat: ${event.latlng.lat.toFixed(3)}, Lon: ${event.latlng.lng.toFixed(3)}`)
////////////////////////////////////////////////////////////////////////  LEGENDS AND LAYER GROUPS
  mapObj.createPane("watershedlayers")
  mapObj.getPane("watershedlayers").style.zIndex = 250
  // add the legends box to the map
  let legend = L.control({position: "bottomright"})
  legend.onAdd = () => {
    let div = L.DomUtil.create("div", "legend")
    const legendEntries = [
      ["purple", "20+ yr Return Period Flow"],
      ["red", "10+ yr Return Period Flow"],
      ["gold", "2+ yr Return Period Flow"],
      ["blue", "Stream Line"]
    ]
    const polyLineSVG = (color, label) => `<div><svg width="20" height="20" viewPort="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline points="19 1, 1 6, 19 14, 1 19" stroke="${color}" fill="transparent" stroke-width="2"/></svg>${label}</div>`
    div.innerHTML =
      '<div class="legend">' +
      legendEntries.map(entry => polyLineSVG(...entry)).join("") +
      "</div>"
    return div
  }
  legend.addTo(mapObj)
////////////////////////////////////////////////////////////////////////  ESRI LAYER ANIMATION CONTROLS
  let layerAnimationTime = new Date()
  layerAnimationTime = new Date(layerAnimationTime.toISOString())
  layerAnimationTime.setUTCHours(0)
  layerAnimationTime.setUTCMinutes(0)
  layerAnimationTime.setUTCSeconds(0)
  layerAnimationTime.setUTCMilliseconds(0)
  const currentDate = document.getElementById("current-map-date")
  const slider = document.getElementById("time-slider")
  const animationDays = 14  // 15 days
  const stepsPerDay = 8  // 3 hour steps
  const numAnimateSteps = animationDays * stepsPerDay
  const startDateTime = new Date(layerAnimationTime)
  const endDateTime = new Date(layerAnimationTime.setUTCHours(animationDays * 24))
  let animate = false
  let animateSpeed = 750
  layerAnimationTime = new Date(startDateTime)
  currentDate.innerHTML = layerAnimationTime
  slider.addEventListener("change", _ => refreshLayerAnimation())

  const refreshLayerAnimation = () => {
    layerAnimationTime = new Date(startDateTime)
    layerAnimationTime.setUTCHours(slider.val() * 3)
    currentDate.innerHTML = layerAnimationTime
    esriStreamLayer.setTimeRange(layerAnimationTime, endDateTime)
  }
  const playAnimation = (once = false) => {
    if (!animate) return
    animate = !once  // toggle animation if play once (once =true, animate = false)
    layerAnimationTime < endDateTime ? slider.val(Number(slider.val()) + 1) : slider.val(0)
    refreshLayerAnimation()
    setTimeout(playAnimation, animateSpeed)
  }

  document.getElementById("animationPlay").addEventListener("click", () => {
    animate = true
    playAnimation()
  })
  document.getElementById("animationStop").addEventListener("click", () => animate = false)
  document.getElementById("animationPlus1").addEventListener("click", () => {
    animate = true
    playAnimation(true)
  })
  document.getElementById("animationBack1").addEventListener("click", () => {
    layerAnimationTime > startDateTime ? slider.val(Number(slider.val()) - 1) : slider.val(numAnimateSteps)
    refreshLayerAnimation()
  })
////////////////////////////////////////////////////////////////////////  ADD WMS LAYERS FOR DRAINAGE LINES, ETC - SEE HOME.HTML TEMPLATE
  const esriStreamLayer = L
    .esri
    .dynamicMapLayer({
      url: ESRI_LAYER_URL,
      useCors: false,
      layers: [0],
      from: startDateTime,
      to: endDateTime,
    })
    .addTo(mapObj)
  L
    .control
    .layers(
      basemapsJson,
      {
        "Stream Network": esriStreamLayer,
      },
      {collapsed: false}
    )
    .addTo(mapObj)

  mapObj.on("click", event => {
    if (mapObj.getZoom() < MIN_QUERY_ZOOM) {
      mapObj.flyTo(event.latlng, MIN_QUERY_ZOOM, {duration: 0.5})
      mapObj.fire('zoomend')
      return
    }
    if (mapMarker) mapObj.removeLayer(mapMarker)
    mapMarker = L.marker(event.latlng).addTo(mapObj)

    updateStatusIcons({reachid: "load", forecast: "clear", retro: "clear"})

    L
      .esri
      .identifyFeatures({url: ESRI_LAYER_URL})
      .on(mapObj)
      .at([event.latlng["lat"], event.latlng["lng"]])
      .tolerance(10) // map pixels to buffer search point
      .precision(6) // decimals in the returned coordinate pairs
      .run((error, featureCollection) => {
        if (error) {
          updateStatusIcons({reachid: "fail"})
          alert("Error finding the reach_id")
          return
        }
        selectedSegment.clearLayers()
        REACHID = featureCollection?.features[0]?.properties["TDX Hydro Link Number"]
        if (REACHID === "Null") {
          updateStatusIcons({reachid: "fail"})
          alert("Error finding the reach_id")
          return
        }
        selectedSegment.addData(featureCollection.features[0].geometry)
        fetchData(REACHID)
      })
  })

//////////////////////////////////////////////////////////////////////// OTHER UTILITIES ON THE LEFT COLUMN
  const fetchData = reachid => {
    REACHID = reachid ? reachid : REACHID
    updateStatusIcons({reachid: "ready", forecast: "clear", retro: "clear"})
    clearChartDivs()
    document.getElementById('auto-load-forecasts').checked ? getForecastData() : giveForecastRetryButton(REACHID)
    document.getElementById('auto-load-retrospective').checked ? getRetrospectiveData() : giveRetrospectiveRetryButton(REACHID)
  }
  const findReachID = () => {
    fetch(
      `${URL_findRiverID}${L.Util.getParamString({reach_id: prompt("Please enter a Reach ID to search for")})}`,
      {mode: "no-cors"}
    )
      .then(response => response.json())
      .then(response => {
        if (mapMarker) mapObj.removeLayer(mapMarker)
        mapMarker = L.marker(L.latLng(response.lat, response.lon)).addTo(mapObj)
        mapObj.flyTo(L.latLng(response["lat"], response["lon"]), MIN_QUERY_ZOOM)
      })
      .catch(() => alert("Unable to find that reach_id. Please check the number and try again."))
  }

  const setReachID = () => {
    REACHID = prompt("Please enter a 9 digit River ID to search for.")
    if (!REACHID) return
    // check that it is a 9 digit number
    if (!/^\d{9}$/.test(REACHID)) return alert("River ID numbers should be 9 digit numbers")
    fetchData(parseInt(REACHID))
  }

  const findLatLon = () => {
    let ll = prompt(
      "Enter a latitude and longitude coordinate pair separated by a comma. For example, to get to Provo, Utah you would enter: 40.25, -111.65",
      "40.25, -111.65"
    )
    ll = ll
      .replace(" ", "")
      .replace("(", "")
      .replace(")", "")
      .split(",")
    if (mapMarker) mapObj.removeLayer(mapMarker)
    mapMarker = L.marker(L.latLng(ll[0], ll[1])).addTo(mapObj)
    mapObj.flyTo(L.latLng(ll[0], ll[1]), MIN_QUERY_ZOOM)
  }

//////////////////////////////////////////////////////////////////////// UPDATE DOWNLOAD LINKS FUNCTION
  const updateDownloadLinks = type => {
    if (type === "clear") {
      document.getElementById("download-forecast-btn").href = ""
      document.getElementById("download-historical-btn").href = ""
    } else if (type === "set") {
      document.getElementById("download-forecast-btn").href = `${REST_ENDPOINT}forecast/${REACHID}`
      document.getElementById("download-historical-btn").href = `${REST_ENDPOINT}retrospective/${REACHID}`
    }
  }

////////////////////////////////////////////////////////////////////////  GET DATA FROM API AND MANAGING PLOTS
  const chartDivs = [
    document.getElementById("forecastPlot"),
    // document.getElementById("fcEnsPlot"),
    // document.getElementById("fcProbTable"),
    document.getElementById("retroPlot"),
    // document.getElementById("dayAvgPlot"),
    // document.getElementById("annAvgPlot"),
    // document.getElementById("fdcPlot")
  ]

  const getForecastData = reachID => {
    REACHID = reachID ? reachID : REACHID
    if (!REACHID) return
    let ftl = document.getElementById("forecast_tab_link") // select divs with jquery so we can reuse them
    let simpleForecast = chartDivs[0]
    let ensembleForecast = chartDivs[1]
    let probabilityTable = chartDivs[2]
    simpleForecast.innerHTML = `<img alt="loading signal" src=${LOADING_GIF}>`
    // ensembleForecast.innerHTML = ''
    // probabilityTable.innerHTML = ''
    updateStatusIcons({forecast: "load"})
    fetch(
      `https://geoglows.ecmwf.int/api/v2/forecast/${REACHID}/?format=json&date=${document.getElementById("forecast_date").value.replaceAll("-", "")}`
    )
      .then(response => response.json())
      .then(response => {
        Plotly.newPlot(
          'forecastPlot',
          [
            {
              x: response.datetime,
              y: response.flow_median,
              name: 'median'
            },
            {
              x: response.datetime,
              y: response.flow_uncertainty_lower,
              name: 'lower'
            },
            {
              x: response.datetime,
              y: response.flow_uncertainty_upper,
              name: 'upper'
            }
          ]
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
    let tl = document.getElementById("historical_tab_link")  // select divs with jquery so we can reuse them
    chartDivs.slice(3).forEach(div => div.innerHTML = "")  // clear the historical data divs
    document.getElementById("retroPlot").innerHTML = `<img alt="loading signal" src=${LOADING_GIF}>`
    fetch(
      `https://geoglows.ecmwf.int/api/v2/retrospective/${REACHID}/?format=json`
    )
      .then(response => response.json())
      .then(response => {
        Plotly.newPlot(
          'retroPlot',
          [
            {
              x: response.datetime,
              y: response[REACHID],
            }
          ]
        )
        updateDownloadLinks("set")
        updateStatusIcons({retro: "ready"})
      })
      .catch(() => {
        updateStatusIcons({retro: "fail"})
        giveRetrospectiveRetryButton(REACHID)
      })
  }

//////////////////////////////////////////////////////////////////////// UPDATE STATUS ICONS FUNCTION
  const updateStatusIcons = status => {
    for (let key in status) {
      loadingStatus[key] = status[key]
    }
    let statusDivs = [
      ['reachid', 'Find River ID'],
      ['forecast', 'Get Forecast'],
      ['retro', 'Get Retrospective']
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

    document.getElementById("request-status").innerHTML = statusDivs
  }

  const fixChartSizes = tab => {
    const divsToFix = tab === "forecast" ? chartDivs.slice(0, 3) : chartDivs.slice(3)
    divsToFix.forEach(div => {
      try {
        Plotly.Plots.resize(div[0])
      } catch (e) {
      }
    })
  }

  const clearChartDivs = (chartTypes) => {
    let divsToClear
    if (chartTypes === "forecast") {
      divsToClear = chartDivs.slice(0, 3)
    } else if (chartTypes === "retrospective") {
      divsToClear = chartDivs.slice(3)
    } else {
      divsToClear = chartDivs
    }
    divsToClear.forEach(div => {
      div.innerHTML = ""
    })
  }

  const giveForecastRetryButton = reachid => {
    clearChartDivs({chartTypes: "forecast"})
    document.getElementById("forecastPlot").innerHTML = `<button class="btn btn-warning" onclick="app.getForecastData(${reachid})">Retry Retrieve Forecast</button>`
  }
  const giveRetrospectiveRetryButton = reachid => {
    clearChartDivs({chartTypes: "historical"})
    document.getElementById("retroPlot").innerHTML = `<button class="btn btn-warning" onclick="app.getRetrospectiveData(${reachid})">Retrieve Retrospective Data</button>`
  }

  document.getElementById("forecast_date").addEventListener("change", () => getForecastData())

  const clearMarkers = () => {
    if (mapMarker) mapObj.removeLayer(mapMarker)
  }
  return {
    fixChartSizes,
    findLatLon,
    findReachID,
    clearMarkers,
    getForecastData,
    getRetrospectiveData,
    setReachID,
  }
})()