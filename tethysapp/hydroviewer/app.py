from tethys_sdk.base import TethysAppBase


class Hydroviewer(TethysAppBase):
    """
    Tethys app class for GEOGloWS V2 Hydroviewer.
    """

    name = 'GEOGLOWS Hydroviewer'
    description = 'Graphical interface for the GEOGLOWS Hydrologic Model'
    package = 'hydroviewer'  # WARNING: Do not change this value
    index = 'home'
    icon = f'{package}/images/earthwater.png'
    root_url = 'hydroviewer'
    color = '#0061AA'
    tags = ''
    enable_feedback = False
    feedback_emails = []