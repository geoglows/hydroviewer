import geoglows
import matplotlib
import pandas as pd
from django.http import JsonResponse
from django.shortcuts import render
from tethys_sdk.routing import controller

# necessary for matplotlib to work in django processes
matplotlib.use('Agg')


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
    reach_id = int(request.GET['reach_id'])

    df = geoglows.data.retrospective(reach_id)
    dayavg_df = geoglows.analyze.daily_averages(df)
    monavg_df = geoglows.analyze.monthly_averages(df)
    annavg_df = geoglows.analyze.annual_averages(df)

    json_response = {
        'retro': geoglows.plots.retrospective(df, plot_type='html'),
        'dayAvg': geoglows.plots.daily_averages(dayavg_df, plot_type='html'),
        'monAvg': geoglows.plots.monthly_averages(monavg_df, plot_type='html'),
        'annAvg': geoglows.plots.annual_averages(annavg_df, plot_type='html'),
    }

    return JsonResponse(json_response)


@controller(name='find-river', url='find-river')
def find_river(request):
    lat, lon = geoglows.streams.reach_to_latlon(int(request.GET['reach_id']))
    return JsonResponse({'lat': lat, 'lon': lon})
