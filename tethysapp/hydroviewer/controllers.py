import datetime

import geoglows as gg
from django.http import JsonResponse
from django.shortcuts import render
from tethys_sdk.routing import controller


@controller
def home(request):
    """
    Controller for the app home page.
    """
    dates = gg.data.dates().values.flatten()
    dates = [(date, f'{date[0:4]}-{date[4:6]}-{date[6:8]}') for date in dates]
    dates = sorted(dates, reverse=True)
    context = {
        'dates': dates,
        'endpoint': gg.data.DEFAULT_REST_ENDPOINT,
        'version': gg.data.DEFAULT_REST_ENDPOINT_VERSION,
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
        ens = gg.data.forecast_ensembles(reach_id, date=forecast_date, source=source)
        rp = gg.data.return_periods(reach_id)
        simple = gg.analyze.simple_forecast(ens)
    except Exception as e:
        print(e)
        return JsonResponse({'error': str(e)})

    json_respones = {
        'ens': gg.plots.forecast_ensembles(ens, rp_df=rp, plot_type='html'),
        'simple': gg.plots.forecast(simple, rp_df=rp, plot_type='html'),
        'rpt': gg.tables.flood_probabilities(ens, rp),
    }
    return JsonResponse(json_respones)


@controller(name='get-retrospective', url='get-retrospective')
def get_retrospective(request):
    print(f'{datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")} - start processing')
    river_id = int(request.GET['reach_id'])
    df = gg.data.retrospective(river_id=river_id)
    rp = gg.data.return_periods(river_id=river_id)

    print(f'{datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")} - data retrieved')
    json_response = {
        'retro': gg.plots.retrospective(df, plot_type='html', rp_df=rp),
        'dayAvg': gg.plots.daily_averages(gg.analyze.daily_averages(df), plot_type='html'),
        'annAvg': gg.plots.annual_averages(gg.analyze.annual_averages(df), plot_type='html'),
        'fdc': gg.plots.flow_duration_curve(df, plot_type='html'),
    }
    print(f'{datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")} - plotting processing finished')
    return JsonResponse(json_response)


@controller(name='find-river', url='find-river')
def find_river(request):
    lat, lon = gg.streams.river_to_latlon(int(request.GET['reach_id']))
    return JsonResponse({'lat': lat, 'lon': lon})
