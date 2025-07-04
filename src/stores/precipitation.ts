import {defineStore} from 'pinia';
import sdk from 'src/composables/sdk';
import {format} from 'date-fns'
import {findIndex} from 'lodash';

export const usePrecipitationStore = defineStore('precipitation', {
    state: () => ({
        initialized: false,
        startTime: 0,
        endTime: 0,
        currentTime: 0,
        step: 600,
        selectedResolution: '1km',
        selectedDuration: '1h',

        optInThumbnailLoading: false,

        spec: undefined as Nullable<MapSpec>,
        list: undefined as Nullable<PrecipitationAnalysisList>,
        currentList: {} as { [time: number]: PrecipitationAnalysisFile },
        currentData: undefined as Nullable<PrecipitationAnalysisFile>,
        dataChanged: false,
        isInPlayback: false,

        displayTorrentialRain: false,
        torrentialRainAvailable: false,

        displayGpv: false,
        gpvAvailable: false,

        displayRainMeasurements: false,
        rainMeasurementsAvailable: false,
        rainMeasurementsTime: '',
        rainMeasurementsSuccess: false,

        legendOptions: undefined as LegendOptions | undefined,
        mapOptions: {} as { [name: string]: MapInterface },
        mapIsLoading: false,
        timeOptions: [
            {label: '1H', value: '1h'},
            {label: '3H', value: '3h'},
            {label: '24H', value: '24h'},
        ],
        resolutionOptions: [
            {label: '1KM', value: '1km', thumbnail: false},
            {label: '5KM', value: '5km', thumbnail: true}
        ] as ResolutionOptions[],
        rainMeasurementsDisplayOption: '3d'
    }),
    getters: {
        mapId: (state) => {
            return `${state.selectedDuration}_${state.selectedResolution}`
        },
        currentTimeFormatted: (state) => {
            return format(new Date(state.currentTime * 1000), 'yyyy-MM-dd HH:mm');
        },
        thumbnailQualityResolution: (state) => {
            return state.resolutionOptions[
                findIndex(state.resolutionOptions, (e: ResolutionOptions) => e.thumbnail === true)
                ].value;
        }
    },
    actions: {
        setList(data: Nullable<PrecipitationAnalysisList>, mutationType: string) {
            this.list = data;
            this.initDataList(mutationType);
        },
        setSpec(spec: Nullable<MapSpec>) {
            if (spec === undefined || spec === null) {
                sdk.showNotification('negative', 'Unexpected null spec!');
                return
            }
            this.spec = spec;
            this.timeOptions = this.spec.durations;
            this.selectedResolution = this.spec.default.resolution;
            this.selectedDuration = this.spec.default.duration;
            this.mapOptions = this.spec.maps;
        },
        setOptions(resolution: string | undefined, duration: string | undefined, torrential: boolean | undefined, gpv: boolean | undefined, station: boolean | undefined) {
            if (resolution !== undefined) {
                this.selectedResolution = resolution;
            }
            if (duration !== undefined) {
                this.selectedDuration = duration;
            }
            if (torrential !== undefined && this.torrentialRainAvailable) {
                this.displayTorrentialRain = torrential;
            }
            if (gpv !== undefined && this.gpvAvailable) {
                this.displayGpv = gpv;
            }
            if (station !== undefined && this.rainMeasurementsAvailable) {
                this.displayRainMeasurements = station;
            }
        },

        initDataList(mutationType: string) {
            if (this.list === undefined || this.list === null) {
                sdk.showNotification('negative', 'List is null!');
                return
            }
            if (this.spec === undefined || this.spec === null) {
                sdk.showNotification('negative', 'Spec has not been loaded!');
                return;
            }
            if (this.mapOptions[this.mapId] === undefined) {
                // When something is changed, we knew that the changed parameter
                // couldn't have problems, since it's checked.
                if (mutationType === 'duration') {
                    this.selectedResolution = this.spec.default.resolution;
                } else if (mutationType === 'resolution') {
                    this.selectedDuration = this.spec.default.duration;
                } else if (mutationType === 'initialize' || mutationType === 'refresh') {
                    // Do nothing.
                } else {
                    sdk.showNotification('negative', `Exhaustive handling of mutationTypes: ${mutationType}`);
                    return;
                }
            }

            this.initLegends();
            this.initResolution();
            this.initTorrentialRain();
            this.initGpv();
            this.initRainMeasurements();

            const dataId = this.mapOptions[this.mapId].data_id;
            let data: Nullable<Array<PrecipitationAnalysisFile>> =
                this.list[dataId as keyof PrecipitationAnalysisList];
            if (data === undefined || data === null) {
                sdk.showNotification('negative', `Shouldn\'t happen: data is null of dataId ${dataId}`);
                return;
            }

            data = data.sort((a, b) => a.time - b.time);
            this.startTime = data[0].time;
            const endTime = data.at(-1);
            if (endTime === undefined || endTime === null) {
                sdk.showNotification('negative', 'Shouldn\'t happen! endTime is null');
                return;
            } else {
                this.endTime = endTime.time;
            }

            this.currentList = {};
            data.forEach(content => {
                this.currentList[content.time] = content;
            });

            if (mutationType === 'initialize' || mutationType === 'refresh') {
                // Init time
                this.changeTime(this.endTime);
            }
            this.setCurrentData()
        },
        initResolution() {
            this.resolutionOptions = this.mapOptions[this.mapId].resolution;
        },
        initLegends() {
            this.legendOptions = this.mapOptions[this.mapId].legends;
        },
        initTorrentialRain() {
            this.torrentialRainAvailable = this.mapOptions[this.mapId].torrential_avail;
            if (!this.torrentialRainAvailable) {
                this.displayTorrentialRain = false;
            }
        },
        initGpv() {
            this.gpvAvailable = this.mapOptions[this.mapId].gpv_avail;
            if (!this.gpvAvailable) {
                this.displayGpv = false;
            }
        },
        initRainMeasurements() {
            this.rainMeasurementsAvailable = this.mapOptions[this.mapId].rain_measurements_avail;
            if (!this.rainMeasurementsAvailable) {
                this.displayRainMeasurements = false;
            }
        },

        changeResolution(resolution: string) {
            this.selectedResolution = resolution;
            this.initDataList('resolution');
        },
        changeDuration(duration: string) {
            this.selectedDuration = duration;
            this.initDataList('duration');
        },
        changeTime(time: number) {
            if (time < this.startTime || time > this.endTime) {
                console.warn('Invalid time')
                return
            }
            if (this.mapIsLoading) {
                return;
            }
            this.currentTime = time;
            this.setCurrentData();
        },
        setCurrentData() {
            const data = this.currentList[this.currentTime];
            if (data === undefined) {
                sdk.showNotification('negative', 'Shouldn\'t happen! currentList[currentTime] is null');
                return
            }

            this.currentData = data;
            this.dataChanged = true;
        }
    }
});
