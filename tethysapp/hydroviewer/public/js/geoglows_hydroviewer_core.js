const app = (() => {
    'use strict'

//////////////////////////////////////////////////////////////////////// State Variables
    ////// URLS FROM TEMPLATE RENDER
    // const endpoint = "{{ endpoint }}";
    // const URL_getForecastData = "{% url 'hydroviewer:get-forecast' %}";
    // const URL_getHistoricalData = "{% url 'hydroviewer:get-retrospective' %}";
    // const URL_findReachID = "{% url 'hydroviewer:find-river' %}";

    let loadingStatus = {reachid: "clear", forecast: "clear", retro: "clear"}
    let REACHID
    let mapMarker = null

//////////////////////////////////////////////////////////////////////// ESRI Map
    const mapObj = L.map("map", {
        zoom: 3,
        minZoom: 2,
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
        div.innerHTML = '<div id="mouse-position" style="text-align: center"></div>'
        return div
    }
    latlon.addTo(mapObj)
    mapObj.on("mousemove", event => {
        $("#mouse-position").html(
            "Lat: " + event.latlng.lat.toFixed(4) + ", Lon: " + event.latlng.lng.toFixed(4)
        )
    })
////////////////////////////////////////////////////////////////////////  LEGENDS AND LAYER GROUPS
    mapObj.createPane("watershedlayers")
    mapObj.getPane("watershedlayers").style.zIndex = 250
    mapObj.createPane("viirs")
    mapObj.getPane("viirs").style.zIndex = 200
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
            legendEntries.map(entry => polyLineSVG(...entry)).join("").join("") +
            "</div>"
        return div
    }
    legend.addTo(mapObj)
////////////////////////////////////////////////////////////////////////  VIIRS COMPOSITE LAYER
    const VIIRSlayer = L.tileLayer(
        "https://floods.ssec.wisc.edu/tiles/RIVER-FLDglobal-composite/{z}/{x}/{y}.png",
        {
            layers: "RIVER-FLDglobal-composite: Latest",
            crossOrigin: true,
            pane: "viirs"
        }
    )
////////////////////////////////////////////////////////////////////////  ESRI LAYER ANIMATION CONTROLS
    let layerAnimationTime = new Date()
    layerAnimationTime = new Date(layerAnimationTime.toISOString())
    layerAnimationTime.setUTCHours(0)
    layerAnimationTime.setUTCMinutes(0)
    layerAnimationTime.setUTCSeconds(0)
    layerAnimationTime.setUTCMilliseconds(0)
    const currentDate = $("#current-map-date")
    const slider = $("#time-slider")
    const animationDays = 5
    const stepsPerDay = 8
    const numAnimateSteps = animationDays * stepsPerDay
    const startDateTime = new Date(layerAnimationTime)
    const endDateTime = new Date(layerAnimationTime.setUTCHours(animationDays * 24))
    let animate = false
    let animateSpeed = 750
    layerAnimationTime = new Date(startDateTime)
    currentDate.html(layerAnimationTime)
    slider.change(_ => refreshLayerAnimation())

    const refreshLayerAnimation = () => {
        layerAnimationTime = new Date(startDateTime)
        layerAnimationTime.setUTCHours(slider.val() * 3)
        currentDate.html(layerAnimationTime)
        esriStreamLayer.setTimeRange(layerAnimationTime, endDateTime)
    }
    const playAnimation = (once = false) => {
        if (!animate) return
        animate = !once  // toggle animation if play once (once =true, animate = false)
        layerAnimationTime < endDateTime ? slider.val(Number(slider.val()) + 1) : slider.val(0)
        refreshLayerAnimation()
        setTimeout(playAnimation, animateSpeed)
    }

    $("#animationPlay").click(() => {
        animate = true
        playAnimation()
    })
    $("#animationStop").click(() => animate = false)
    $("#animationPlus1").click(() => {
        animate = true
        playAnimation(true)
    })
    $("#animationBack1").click(() => {
        layerAnimationTime > startDateTime ? slider.val(Number(slider.val()) - 1) : slider.val(numAnimateSteps)
        refreshLayerAnimation()
    })
////////////////////////////////////////////////////////////////////////  ADD WMS LAYERS FOR DRAINAGE LINES, VIIRS, ETC - SEE HOME.HTML TEMPLATE
    const esriStreamLayer = L
        .esri
        .dynamicMapLayer({
            url: "https://livefeeds2.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer",
            useCors: false,
            layers: [0],
            from: startDateTime,
            to: endDateTime
        })
        .addTo(mapObj)
    L.control
        .layers(
            basemapsJson,
            {
                "Stream Network": esriStreamLayer,
                "VIIRS Imagery": VIIRSlayer
            },
            {collapsed: false}
        )
        .addTo(mapObj)

    mapObj.on("click", event => {
        if (mapObj.getZoom() <= 9.5) return mapObj.flyTo(event.latlng, 10)
        mapObj.flyTo(event.latlng)

        if (mapMarker) {
            mapObj.removeLayer(mapMarker)
        }
        mapMarker = L.marker(event.latlng).addTo(mapObj)
        updateStatusIcons({reachid: "load", forecast: "clear", retro: "clear"})
        $("#chart_modal").modal("show")

        L.esri
            .identifyFeatures({url: "https://livefeeds2.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer"})
            .on(mapObj)
            .at([event.latlng["lat"], event.latlng["lng"]])
            .tolerance(10) // map pixels to buffer search point
            .precision(3) // decimals in the returned coordinate pairs
            .run((error, featureCollection) => {
                if (error) {
                    updateStatusIcons({reachid: "fail"})
                    alert("Error finding the reach_id")
                    return
                }
                updateStatusIcons({reachid: "ready"})
                selectedSegment.clearLayers()
                selectedSegment.addData(featureCollection.features[0].geometry)
                REACHID = featureCollection.features[0].properties["COMID (Stream Identifier)"]
                clearChartDivs()
                getForecastData()
                getHistoricalData()
            })
    })

//////////////////////////////////////////////////////////////////////// OTHER UTILITIES ON THE LEFT COLUMN
    const findReachID = () => {
        $.ajax({
            type: "GET",
            async: true,
            url:
                URL_findReachID +
                L.Util.getParamString({reach_id: prompt("Please enter a Reach ID to search for")}),
            success: response => {
                if (mapMarker) mapObj.removeLayer(mapMarker)
                mapMarker = L.marker(L.latLng(response.lat, response.lon)).addTo(mapObj)
                mapObj.flyTo(L.latLng(response["lat"], response["lon"]), 9)
            },
            error: () => alert("Unable to find that reach_id. Please check the number and try again.")
        })
    }

    const findLatLon = () => {
        let ll = prompt(
            "Enter a latitude and longitude coordinate pair separated by a comma. For example, to get to BYU you would enter: 40.25, -111.65",
            "40.25, -111.65"
        )
        ll = ll
            .replace(" ", "")
            .replace("(", "")
            .replace(")", "")
            .split(",")
        if (mapMarker) mapObj.removeLayer(mapMarker)
        mapMarker = L.marker(L.latLng(ll[0], ll[1])).addTo(mapObj)
        mapObj.flyTo(L.latLng(ll[0], ll[1]), 9)
    }

//////////////////////////////////////////////////////////////////////// UPDATE DOWNLOAD LINKS FUNCTION
    const updateDownloadLinks = type => {
        if (type === "clear") {
            $("#download-forecast-btn").attr("href", "")
            $("#download-historical-btn").attr("href", "")
        } else if (type === "set") {
            $("#download-forecast-btn").attr("href", endpoint + "ForecastStats/?reach_id=" + REACHID)
            $("#download-historical-btn").attr("href", endpoint + "HistoricSimulation/?reach_id=" + REACHID)
        }
    }

////////////////////////////////////////////////////////////////////////  GET DATA FROM API AND MANAGING PLOTS
    const chartDivs = [
        $("#forecastPlot"),
        $("#fcEnsPlot"),
        $("#fcProbTable"),
        $("#retroPlot"),
        $("#dayAvgPlot"),
        $("#monAvgPlot"),
        $("#annAvgPlot"),
    ]

    const getForecastData = () => {
        let ftl = $("#forecast_tab_link") // select divs with jquery so we can reuse them
        ftl.tab("show")
        let fc = chartDivs[0]
        fc.html(`<img alt="loading signal" src=${loading_gif}>`)
        fc.css("text-align", "center")
        updateStatusIcons({forecast: "load"})
        $.ajax({
            type: "GET",
            async: true,
            data: {reach_id: REACHID},
            url: URL_getForecastData,
            success: response => {
                ftl.tab("show")
                fc.html(response["plot"])
                $("#forecast-table").html(response["table"])
                updateStatusIcons({forecast: "ready"})
            },
            error: () => {
                updateStatusIcons({forecast: "fail"})
                REACHID = null
            }
        })
    }

    const getHistoricalData = () => {
        updateStatusIcons({retro: "load"})
        updateDownloadLinks("clear")
        let tl = $("#historical_tab_link") // select divs with jquery so we can reuse them
        tl.tab("show")
        let plotdiv = chartDivs[2]
        plotdiv.css("text-align", "center")
        $.ajax({
            type: "GET",
            async: true,
            data: {reach_id: REACHID},
            url: URL_getHistoricalData,
            success: response => {
                updateStatusIcons({retro: "ready"})
                tl.tab("show")
                plotdiv.html(response.retro)
                $("#dayAvgPlot").html(response.dayAvg)
                $("#monAvgPlot").html(response.monAvg)
                $("#annAvgPlot").html(response.annAvg)
            },
            error: () => updateStatusIcons({retro: "fail"})
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
            ['retro', 'Get Historical']
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

        $("#request-status").html(statusDivs)
    }

    const fix_buttons = tab => {
        let buttons = [
            $("#download-forecast-btn"),
            $("#download-historical-btn"),
        ]
        for (let i in buttons) {
            buttons[i].hide()
        }
        if (tab === "forecast") {
            buttons[0].show()
        } else if (tab === "historical") {
            buttons[1].show()
        }
        fixChartSizes(tab)
        $("#resize_charts").attr({onclick: "fixChartSizes('" + tab + "')"})
    }

    const fixChartSizes = tab => {
        //     divs = [$("#forecastPlot .js-plotly-plot")]
        const divsToFix = tab === "forecast" ? chartDivs.slice(0, 3) : chartDivs.slice(3)
        divsToFix.forEach(div => {
            // select divs with the .js-plotly-plot class
            try {
                div.css("height", "500px")
                Plotly.Plots.resize(div[0])
            } catch (e) {
            }
        })
    }

    const clearChartDivs = () => {
        chartDivs.forEach(div => {
            div.css("height", "0px")
            div.html("")
        })
    }

    $("#forecast_tab_link").on("click", () => fix_buttons("forecast"))
    $("#historical_tab_link").on("click", () => fix_buttons("historical"))

    const clearMarkers = () => {
        if (mapMarker) mapObj.removeLayer(mapMarker)
    }
    return {
        fixChartSizes,
        findLatLon,
        findReachID,
        clearMarkers,
    }
})()