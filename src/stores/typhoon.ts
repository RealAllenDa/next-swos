import {defineStore} from 'pinia';
import {compareAsc, parse} from 'date-fns';

export const useTyphoonStore = defineStore('typhoon', {
  state: () => ({
    typhoonList: [] as TyphoonList[],
    typhoons: {} as { [id: string]: TyphoonList },

    showInactiveTyphoons: true,
    showTyphoonForecastOrigins: ['中国', '中国台湾', '日本', '中国香港', '美国'] as string[],

    typhoonDisplayList: [] as string[],
    selectedTyphoonsInList: [] as TyphoonList[],

    currentTyphoons: {} as { [id: string]: TyphoonDetail },
    currentTyphoonFocus: '' as string,
    typhoonsToFocus: [] as ChooseOptions[],
    currentTyphoonIndex: 0,

    typhoonOrigins: [
      {label: '中国', value: '中国'},
      {label: '中国台湾', value: '中国台湾'},
      {label: '日本', value: '日本'},
      {label: '中国香港', value: '中国香港'},
      {label: '美国', value: '美国'}
    ],
    detailColumns: [
      {
        name: 'date',
        required: true,
        align: 'center',
        field: 'date',
        label: 'Date',
        sortable: true,
        sort: (a: string, b: string) => {
          const dateOfA = parse(a, 'MM/dd HH:mm', new Date());
          const dateOfB = parse(b, 'MM/dd HH:mm', new Date());
          return compareAsc(dateOfA, dateOfB);
        }
      },
      {
        name: 'category',
        align: 'center',
        field: 'category',
        label: 'Category',
        sortable: false
      },
      {
        name: 'pressure',
        align: 'center',
        field: 'pressure',
        label: 'Pressure',
        sortable: false
      },
      {
        name: 'speed',
        align: 'center',
        field: 'speed',
        label: 'Wind Speed',
        sortable: false
      },
      {
        name: 'move_speed',
        align: 'center',
        field: 'move_speed',
        label: 'Move Speed',
        sortable: false
      }
    ]
  }),
  actions: {
    clearLists() {
      this.currentTyphoonIndex = 0;
      this.typhoonDisplayList = [];
      this.typhoons = {};
      this.currentTyphoons = {};
      this.selectedTyphoonsInList = [];
      this.typhoonsToFocus = [];
    },
    getTyphoonId(typhoon: TyphoonList, showInactiveSign = true) {
      if (typhoon.is_active === 0 && showInactiveSign) {
        return `[INACTIVE] ${typhoon.name} - ${typhoon.eng_name}`
      } else {
        return `${typhoon.name} - ${typhoon.eng_name}`
      }
    },
    updateSelectedTyphoon(typhoons: string[]) {
      this.typhoonsToFocus = [];
      this.currentTyphoonIndex = 0;
      this.selectedTyphoonsInList = [];
      typhoons.forEach((typhoon) => {
        this.selectedTyphoonsInList.push(this.typhoons[typhoon]);
        this.typhoonsToFocus.push({
          label: this.getTyphoonId(this.typhoons[typhoon]),
          value: this.typhoons[typhoon].id,
        })
      });
      this.currentTyphoonFocus = this.typhoonsToFocus[0]?.value;
    },

    setList(list: TyphoonList[]) {
      this.typhoonList = list;
      this.updateList()
    },
    updateList() {
      this.clearLists()
      this.typhoonList.forEach((content) => {
        const typhoonId = this.getTyphoonId(content)
        if (content.is_active === 0) {
          if (this.showInactiveTyphoons) {
            this.typhoons[typhoonId] = content
            this.typhoonDisplayList.push(typhoonId)
          }
        } else {
          this.typhoons[typhoonId] = content
          this.typhoonDisplayList.push(typhoonId)
          this.selectedTyphoonsInList.push(content)
          this.typhoonsToFocus.push({
            label: typhoonId,
            value: content.id
          })
        }
      })
      this.currentTyphoonFocus = this.typhoonsToFocus[0]?.value;
    },


    getFillBrand(point: string): string {
      let brand: string;
      switch (point) {
        case '热带低压':
          brand = 'td';
          break;
        case '热带低气压':
          brand = 'td';
          break;
        case '热带风暴':
          brand = 'ts';
          break;
        case '强热带风暴':
          brand = 'sts';
          break;
        case '台风':
          brand = 'ty';
          break;
        case '强台风':
          brand = 'sty';
          break;
        case '超强台风':
          brand = 'super-ty';
          break;
        default:
          brand = ''
      }
      return brand;
    }
  }
})
