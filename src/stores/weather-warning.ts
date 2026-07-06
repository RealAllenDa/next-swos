import { defineStore } from 'pinia';

export const useWeatherWarningStore = defineStore('warning/weather', {
  state: () => ({
    currentWarningList: {
      coloring: {},
      districts: {},
      message_time: '',
      timestamp: 0,
    } as WeatherWarningList,
    currentSelectedDistrict: '',
  }),
  actions: {
    setCurrentWarningList(list: WeatherWarningList) {
      const excludedDistricts = new Set(['江苏省', '浙江省']);
      this.currentWarningList = {
        ...list,
        coloring: Object.fromEntries(
          Object.entries(list.coloring ?? {}).filter(
            ([district]) => !excludedDistricts.has(district)
          )
        ),
        districts: Object.fromEntries(
          Object.entries(list.districts ?? {}).filter(
            ([district]) => !excludedDistricts.has(district)
          )
        ),
      };
    },
    parseLevel(level: number) {
      return ['未知', '蓝色', '黄色', '橙色', '红色'][level] ?? '未知';
    },
  },
});
