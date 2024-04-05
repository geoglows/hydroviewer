import geoglows as gg
from django.http import JsonResponse
from django.shortcuts import render
from tethys_sdk.routing import controller


@controller
def home(request):
    """
    Controller for the app home page.
    """
    dates = gg.data.dates().values.flatten().tolist()
    dates = [str(date) for date in dates]
    dates = [(date, f'{date[0:4]}-{date[4:6]}-{date[6:8]}') for date in dates]
    return render(request, 'hydroviewer/home.html', {'dates': dates})


@controller(name='get-forecast', url='get-forecast')
def get_forecast(request):
    reach_id = request.GET.get('reach_id', None)
    forecast_date = request.GET.get('forecast_date', None)

    if not reach_id or not forecast_date:
        return JsonResponse({'error': 'Missing required parameters'})

    source = 'hydroviewer'
    try:
        ens = gg.data.forecast_ensembles(reach_id, source=source)
        simple = gg.analyze.simple_forecast(ens)
        simple = simple.rename(columns={'flow_med_cms': 'flow_median_cms'})
    except Exception as e:
        return JsonResponse({'error': str(e)})

    return JsonResponse({
        'ens': gg.plots.forecast_ensembles(ens, plot_type='html'),
        'simple': gg.plots.forecast(simple, plot_type='html'),
    })


@controller(name='get-retrospective', url='get-retrospective')
def get_retrospective(request):
    reach_id = int(request.GET['reach_id'])

    df = gg.data.retrospective(reach_id=reach_id)
    dayavg_df = gg.analyze.daily_averages(df)
    monavg_df = gg.analyze.monthly_averages(df)
    annavg_df = gg.analyze.annual_averages(df)

    json_response = {
        'retro': gg.plots.retrospective(df, plot_type='html'),
        'dayAvg': gg.plots.daily_averages(dayavg_df, plot_type='html'),
        'monAvg': gg.plots.monthly_averages(monavg_df, plot_type='html'),
        'annAvg': gg.plots.annual_averages(annavg_df, plot_type='html'),
    }

    return JsonResponse(json_response)


@controller(name='find-river', url='find-river')
def find_river(request):
    lat, lon = gg.streams.reach_to_latlon(int(request.GET['reach_id']))
    return JsonResponse({'lat': lat, 'lon': lon})
