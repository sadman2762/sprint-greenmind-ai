from pathlib import Path

import numpy as np
import pandas as pd


DATA_DIR = Path(__file__).resolve().parents[3] / 'data' / 'processed'
SOURCE_PATHS = {
    'air': DATA_DIR / 'air_measurements_wide.csv',
    'water': DATA_DIR / 'water_measurements_cleaned.csv',
    'noise': DATA_DIR / 'noise_measurements_cleaned.csv',
}
METRICS = {
    'air': [('pm25', 'PM2.5', 'µg/m³', None, None)],
    'water': [
        ('conductivity', 'Conductivity', 'mS/cm', 'Conductivity', 'mS/cm'),
        ('waterTemperature', 'Water temperature', '°C', 'WaterTemp', 'celsius'),
        ('waterLevel', 'Water level', 'm', 'WaterLevel', 'm'),
    ],
    'noise': [
        ('daytimeNoise', 'Daytime', 'dB', 'LAEQ nappali', 'dB'),
        ('nighttimeNoise', 'Nighttime', 'dB', 'LAEQ éjszakai', 'dB'),
    ],
}
DESCRIPTIONS = {
    'air': 'Daily PM2.5 across reporting sites, not a city-wide exposure estimate or an AQI.',
    'water': 'Historical water measurements, not a drinking-water safety assessment. Water-level reference is unspecified; compare trends with caution.',
    'noise': 'Separate daytime and nighttime sound-energy averages across reporting sites, not a city-wide exposure estimate.',
}


def summarize_metric(data, category, spec, dates):
    key, label, unit, measurement_type, source_unit = spec
    metric = dict(key=key, label=label, unit=unit, stationCount=0, recordCount=0,
                  periodStart=dates[0].strftime('%Y-%m-%d') if len(dates) else None,
                  periodEnd=dates[-1].strftime('%Y-%m-%d') if len(dates) else None,
                  points=[])
    if not len(dates):
        return metric
    if category == 'air':
        records = data[['timestamp', 'date', 'station_code', key]].rename(columns={'station_code': 'site', key: 'value'}).copy()
    else:
        records = data.loc[(data['measurement_type'] == measurement_type) & (data['unit'] == source_unit),
                           ['timestamp', 'date', 'location', 'value']].rename(columns={'location': 'site'}).copy()
    records['value'] = pd.to_numeric(records['value'], errors='coerce')
    records['site'] = records['site'].astype('string').str.strip()
    valid = np.isfinite(records['value']) & records['site'].notna() & records['site'].ne('')
    if key in ('pm25', 'conductivity'):
        valid &= records['value'] >= 0
    if category == 'noise':
        valid &= records['value'].between(0, 200)
    records = records.loc[valid].drop_duplicates(['site', 'timestamp'], keep='last')
    metric['stationCount'] = int(records['site'].nunique())
    metric['recordCount'] = len(records)
    if category == 'noise':
        records['value'] = np.power(10.0, records['value'] / 10)
    site_days = records.groupby(['date', 'site'])['value'].mean()
    daily = site_days.groupby(level='date').mean()
    if category == 'noise':
        daily = 10 * np.log10(daily)
    counts = records.groupby('date').agg(stationCount=('site', 'nunique'), recordCount=('site', 'size'))
    for date in dates:
        value = daily.get(date, np.nan)
        metric['points'].append(dict(
            date=date.strftime('%Y-%m-%d'), value=round(float(value), 3) if np.isfinite(value) else None,
            stationCount=int(counts.loc[date, 'stationCount']) if date in counts.index else 0,
            recordCount=int(counts.loc[date, 'recordCount']) if date in counts.index else 0,
        ))
    return metric


def get_environmental_conditions():
    categories = {}
    for category, path in SOURCE_PATHS.items():
        result = dict(sourceFile=path.name, description=DESCRIPTIONS[category], status='unavailable',
                      message='The historical dataset is unavailable.',
                      metrics=[summarize_metric(pd.DataFrame(), category, spec, []) for spec in METRICS[category]])
        try:
            data = pd.read_csv(path, encoding='utf-8-sig')
            required = {'timestamp', 'station_code', 'pm25'} if category == 'air' else {'timestamp', 'location', 'measurement_type', 'value', 'unit'}
            if not required.issubset(data.columns):
                raise ValueError('Unexpected dataset columns')
            data['timestamp'] = pd.to_datetime(data['timestamp'], errors='coerce', format='mixed')
            data = data.dropna(subset=['timestamp']).copy()
            data['date'] = data['timestamp'].dt.normalize()
            dates = pd.date_range(data['date'].min(), data['date'].max(), freq='D') if len(data) else []
            result['metrics'] = [summarize_metric(data, category, spec, dates) for spec in METRICS[category]]
            available = any(metric['recordCount'] for metric in result['metrics'])
            result.update(status='available' if available else 'empty',
                          message=None if available else 'No valid measurements are available in this dataset.')
        except (OSError, ValueError):
            pass
        categories[category] = result
    return dict(schemaVersion='1.0', source='Historical processed measurements; not live telemetry.',
                aggregation='Each reporting site has equal weight after daily aggregation. Missing days remain gaps; site counts can change. Noise is averaged in sound energy, then converted back to dB.',
                categories=categories)
