import geoglows as g
from django.http import JsonResponse
from django.shortcuts import render
from tethys_sdk.routing import controller


@controller
def home(request):
    context = {
        'endpoint': g.data.DEFAULT_REST_ENDPOINT,
        'version': g.data.DEFAULT_REST_ENDPOINT_VERSION,
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
        ens = g.data.forecast_ensembles(reach_id, date=forecast_date, source=source)
        rp = g.data.return_periods(reach_id)
    except Exception as e:
        print(e)
        return JsonResponse({'error': str(e)})

    json_respones = {
        'ens': g.plots.forecast_ensembles(ens, rp_df=rp, plot_type='html'),
        'simple': g.plots.forecast(g.analyze.simple_forecast(ens), rp_df=rp, plot_type='html'),
        'rpt': g.tables.flood_probabilities(ens, rp),
    }
    return JsonResponse(json_respones)


@controller(name='get-retrospective', url='get-retrospective')
def get_retrospective(request):
    river_id = int(request.GET['reach_id'])
    df = g.data.retrospective(river_id=river_id)
    rp = g.data.return_periods(river_id=river_id)

    json_response = {
        'retro': g.plots.retrospective(df, plot_type='html', rp_df=rp),
        'dayAvg': g.plots.daily_averages(g.analyze.daily_averages(df), plot_type='html'),
        'annAvg': g.plots.annual_averages(g.analyze.annual_averages(df), plot_type='html', decade_averages=True),
        'fdc': g.plots.flow_duration_curve(df, plot_type='html'),
    }
    return JsonResponse(json_response)


@controller(name='find-river', url='find-river')
def find_river(request):
    lat, lon = g.streams.river_to_latlon(int(request.GET['reach_id']))
    return JsonResponse({'lat': lat, 'lon': lon})
