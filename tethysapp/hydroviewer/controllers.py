import geoglows
from django.http import JsonResponse
from django.shortcuts import render
from tethys_sdk.routing import controller


@controller
def home(request):
    return render(request, 'hydroviewer/home.html', {})


@controller(name='get-forecast', url='get-forecast')
def get_forecast(request):
    reach_id = request.GET['reach_id']
    source = 'hydroviewer'
    df = geoglows.data.forecast(reach_id, source=source)
    # todo send json df and do all plots and downloads in js
    return JsonResponse({'plotForecast': geoglows.plots.forecast(df, plot_type='plotly_html')})


@controller(name='get-retrospective', url='get-retrospective')
def get_retrospective(request):
    reach_id = request.GET['reach_id']
    df = geoglows.data.retrospective(reach_id)
    # todo send json of df and averaged dfs
    # todo implement plots in js
    json_response = {
        'retro': geoglows.plots.retrospective(df, plot_type='plotly_html'),
        'dailyAvg': '',
        'monthlyAvg': '',
        'annualAvg': '',
        'fdc': '',
    }
    return JsonResponse(json_response)


@controller(name='find-river', url='find-river')
def find_river(request):
    lat, lon = geoglows.streams.reach_to_latlon(request.GET['reach_id'])
    return JsonResponse({'lat': lat, 'lon': lon})
