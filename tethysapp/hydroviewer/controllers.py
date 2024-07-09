import datetime

import geoglows
from natsort import natsorted
import plotly.graph_objects as go
from django.http import JsonResponse
from django.shortcuts import render
from tethys_sdk.routing import controller


@controller
def home(request):
    """
    Controller for the app home page.
    """
    context = {
        'endpoint': geoglows.data.DEFAULT_REST_ENDPOINT,
        'version': geoglows.data.DEFAULT_REST_ENDPOINT_VERSION,
    }
    return render(request, 'hydroviewer/home.html', context)


@controller(name='get-forecast', url='get-forecast')
def get_forecast(request):
    reach_id = request.GET.get('reach_id', None)
    forecast_date = request.GET.get('forecast_date', None)

    if not reach_id or not forecast_date:
        return JsonResponse({'error': 'Missing required parameters'})

    source = 'hydroviewer'
    reach_id = int(reach_id)
    try:
        ens = geoglows.data.forecast_ensembles(reach_id, date=forecast_date, source=source)
        rp = geoglows.data.return_periods(reach_id)
    except Exception as e:
        print(e)
        return JsonResponse({'error': str(e)})

    # specify that the timezone of the index is UTC then convert it to the desired timezone
    ens.index = ens.index.tz_convert(request.GET.get('timeZone', 'UTC'))

    json_respones = {
        'ens': geoglows.plots.forecast_ensembles(ens, rp_df=rp, plot_type='html'),
        'simple': geoglows.plots.forecast(geoglows.analyze.simple_forecast(ens), rp_df=rp, plot_type='html'),
        'rpt': geoglows.tables.flood_probabilities(ens, rp),
    }
    return JsonResponse(json_respones)


@controller(name='get-retrospective', url='get-retrospective')
def get_retrospective(request):
    river_id = int(request.GET['reach_id'])
    df = geoglows.data.retrospective(river_id=river_id)
    rp = geoglows.data.return_periods(river_id=river_id)

    df = df.tz_convert(request.GET.get('timeZone', 'UTC'))

    json_response = {
        'retro': geoglows.plots.retrospective(df, plot_type='html', rp_df=rp),
        'dayAvg': geoglows.plots.daily_averages(geoglows.analyze.daily_averages(df), plot_type='html'),
        'annAvg': geoglows.plots.annual_averages(geoglows.analyze.annual_averages(df), plot_type='html'),
        'fdc': geoglows.plots.flow_duration_curve(df, plot_type='html'),
    }
    return JsonResponse(json_response)


@controller(name='find-river', url='find-river')
def find_river(request):
    lat, lon = geoglows.streams.river_to_latlon(int(request.GET['reach_id']))
    return JsonResponse({'lat': lat, 'lon': lon})
