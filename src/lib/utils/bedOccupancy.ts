export interface BedOccupancyInput {
  hvec?: number;
  hvs01?: number;
  hv27?: number;
  HVS59?: number;
  hvs59?: number;
  hv29?: number;
  HVS03?: number;
  hvs03?: number;
  hv13?: number;
  HVS46?: number;
  hvs46?: number;
  hv30?: number;
  HVS04?: number;
  hvs04?: number;
  hv14?: number;
  HVS47?: number;
  hvs47?: number;
  hv28?: number;
  HVS02?: number;
  hvs02?: number;
  hv15?: number;
  HVS48?: number;
  hvs48?: number;
  hv16?: number;
  HVS49?: number;
  hvs49?: number;
}

const readNumber = (data: BedOccupancyInput, keys: Array<keyof BedOccupancyInput>) => {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
  }
  return 0;
};

export const getBedValues = (data: BedOccupancyInput) => {
  return {
    general: {
      available: readNumber(data, ['hvec']),
      total: readNumber(data, ['hvs01'])
    },
    cohort: {
      available: readNumber(data, ['hv27']),
      total: readNumber(data, ['HVS59', 'hvs59'])
    },
    erNegative: {
      available: readNumber(data, ['hv29']) + readNumber(data, ['hv13']),
      total: readNumber(data, ['HVS03', 'hvs03']) + readNumber(data, ['HVS46', 'hvs46'])
    },
    erGeneral: {
      available: readNumber(data, ['hv30']) + readNumber(data, ['hv14']),
      total: readNumber(data, ['HVS04', 'hvs04']) + readNumber(data, ['HVS47', 'hvs47'])
    },
    pediatric: {
      available: readNumber(data, ['hv28']),
      total: readNumber(data, ['HVS02', 'hvs02'])
    },
    pediatricNegative: {
      available: readNumber(data, ['hv15']),
      total: readNumber(data, ['HVS48', 'hvs48'])
    },
    pediatricGeneral: {
      available: readNumber(data, ['hv16']),
      total: readNumber(data, ['HVS49', 'hvs49'])
    }
  };
};

export const calculateTotalOccupancy = (data: BedOccupancyInput): number => {
  const beds = getBedValues(data);

  const generalOccupied = Math.max(0, beds.general.total - beds.general.available);
  const cohortOccupied = Math.max(0, beds.cohort.total - beds.cohort.available);
  const erNegativeOccupied = Math.max(0, beds.erNegative.total - beds.erNegative.available);
  const erGeneralOccupied = Math.max(0, beds.erGeneral.total - beds.erGeneral.available);
  const pediatricOccupied = Math.max(0, beds.pediatric.total - beds.pediatric.available);
  const pediatricNegativeOccupied = Math.max(0, beds.pediatricNegative.total - beds.pediatricNegative.available);
  const pediatricGeneralOccupied = Math.max(0, beds.pediatricGeneral.total - beds.pediatricGeneral.available);

  return generalOccupied + cohortOccupied + erNegativeOccupied + erGeneralOccupied +
    pediatricOccupied + pediatricNegativeOccupied + pediatricGeneralOccupied;
};

export const calculateOccupancyRate = (data: BedOccupancyInput): number => {
  const beds = getBedValues(data);

  const totalBeds = beds.general.total + beds.cohort.total + beds.erNegative.total +
    beds.erGeneral.total + beds.pediatric.total + beds.pediatricNegative.total +
    beds.pediatricGeneral.total;

  if (totalBeds === 0) return 0;

  const totalOccupied = calculateTotalOccupancy(data);
  return Math.round((totalOccupied / totalBeds) * 100);
};
