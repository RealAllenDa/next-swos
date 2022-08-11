import {defineStore} from 'pinia';

export const useWeatherWarningStore = defineStore('warning/weather', {
  state: () => ({
    currentWarningList: {} as WeatherWarningList,
    currentSelectedDistrict: ''
  }),
  actions: {
    setCurrentWarningList(list: WeatherWarningList) {
      this.currentWarningList = list;
    },

    parseLevel(level: number) {
      switch (level) {
        case 1:
          return '蓝色';
        case 2:
          return '黄色';
        case 3:
          return '橙色';
        case 4:
          return '红色';
        default:
          return '未知';
      }
    }
  }
})
