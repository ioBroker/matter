import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import GenericDevice, { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class Media extends GenericDevice {
    #getStateState?: DeviceStateObject<boolean | number>;
    #setPlayState?: DeviceStateObject<boolean>;
    #setPauseState?: DeviceStateObject<boolean>;
    #setStopState?: DeviceStateObject<boolean>;
    #setNextState?: DeviceStateObject<boolean>;
    #setPrevState?: DeviceStateObject<boolean>;
    #shuffleState?: DeviceStateObject<boolean>;
    #repeatState?: DeviceStateObject<number>;
    #getArtistState?: DeviceStateObject<string>;
    #getAlbumState?: DeviceStateObject<string>;
    #getTitleState?: DeviceStateObject<string>;
    #getCoverState?: DeviceStateObject<string>;
    #getDurationState?: DeviceStateObject<number>;
    #getElapsedState?: DeviceStateObject<number>;
    #setSeekState?: DeviceStateObject<number>;
    #getTrackState?: DeviceStateObject<string>;
    #getEpisodeState?: DeviceStateObject<string>;
    #getSeasonState?: DeviceStateObject<string>;
    #setVolumeState?: DeviceStateObject<number>;
    #getVolumeState?: DeviceStateObject<number>;
    #muteState?: DeviceStateObject<boolean>;
    #getConnectedState?: DeviceStateObject<boolean>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'STATE',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.Read,
                    type: PropertyType.State,
                    callback: state => (this.#getStateState = state),
                },
                {
                    name: 'PLAY',
                    valueType: ValueType.Button,
                    accessType: StateAccessType.Write,
                    type: PropertyType.Play,
                    callback: state => (this.#setPlayState = state),
                },
                {
                    name: 'PAUSE',
                    valueType: ValueType.Button,
                    accessType: StateAccessType.Write,
                    type: PropertyType.Pause,
                    callback: state => (this.#setPauseState = state),
                },
                {
                    name: 'STOP',
                    valueType: ValueType.Button,
                    accessType: StateAccessType.Write,
                    type: PropertyType.Stop,
                    callback: state => (this.#setStopState = state),
                },
                {
                    name: 'NEXT',
                    valueType: ValueType.Button,
                    accessType: StateAccessType.Write,
                    type: PropertyType.Next,
                    callback: state => (this.#setNextState = state),
                },
                {
                    name: 'PREV',
                    valueType: ValueType.Button,
                    accessType: StateAccessType.Write,
                    type: PropertyType.Previous,
                    callback: state => (this.#setPrevState = state),
                },
                {
                    name: 'SHUFFLE',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Shuffle,
                    callback: state => (this.#shuffleState = state),
                },
                {
                    name: 'REPEAT',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Repeat,
                    callback: state => (this.#repeatState = state),
                },
                {
                    name: 'ARTIST',
                    valueType: ValueType.String,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Artist,
                    callback: state => (this.#getArtistState = state),
                },
                {
                    name: 'ALBUM',
                    valueType: ValueType.String,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Album,
                    callback: state => (this.#getAlbumState = state),
                },
                {
                    name: 'TITLE',
                    valueType: ValueType.String,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Title,
                    callback: state => (this.#getTitleState = state),
                },
                {
                    name: 'COVER',
                    valueType: ValueType.String,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Cover,
                    callback: state => (this.#getCoverState = state),
                },
                {
                    name: 'DURATION',
                    valueType: ValueType.Number,
                    accessType: StateAccessType.Read,
                    unit: 'seconds',
                    type: PropertyType.Duration,
                    callback: state => (this.#getDurationState = state),
                },
                {
                    name: 'ELAPSED',
                    valueType: ValueType.Number,
                    unit: 'seconds',
                    accessType: StateAccessType.Read,
                    type: PropertyType.Elapsed,
                    callback: state => (this.#getElapsedState = state),
                },
                {
                    name: 'SEEK',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Write,
                    type: PropertyType.Seek,
                    callback: state => (this.#setSeekState = state),
                },
                {
                    name: 'TRACK',
                    valueType: ValueType.String,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Track,
                    callback: state => (this.#getTrackState = state),
                },
                {
                    name: 'EPISODE',
                    valueType: ValueType.String,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Episode,
                    callback: state => (this.#getEpisodeState = state),
                },
                {
                    name: 'SEASON',
                    valueType: ValueType.String,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Season,
                    callback: state => (this.#getSeasonState = state),
                },
                // actual value first, as it will be read first
                {
                    name: 'VOLUME_ACTUAL',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Volume,
                    callback: state => (this.#getVolumeState = state || this.#setVolumeState),
                },
                {
                    name: 'VOLUME',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Volume,
                    callback: state => (this.#setVolumeState = state),
                },
                {
                    name: 'MUTE',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Mute,
                    callback: state => (this.#muteState = state),
                },
                // TODO: This must be mapped to reachable
                {
                    name: 'CONNECTED',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Connected,
                    callback: state => (this.#getConnectedState = state),
                },
            ]),
        );
    }

    getState(): boolean | number | undefined {
        if (!this.#getStateState) {
            throw new Error('State state not found');
        }
        return this.#getStateState.value;
    }

    setPlay(): Promise<void> {
        if (!this.#setPlayState) {
            throw new Error('Play state not found');
        }
        return this.#setPlayState.setValue(true);
    }

    setPause(): Promise<void> {
        if (!this.#setPauseState) {
            throw new Error('Pause state not found');
        }
        return this.#setPauseState.setValue(true);
    }

    setStop(): Promise<void> {
        if (!this.#setStopState) {
            throw new Error('Stop state not found');
        }
        return this.#setStopState.setValue(true);
    }

    setNext(): Promise<void> {
        if (!this.#setNextState) {
            throw new Error('Next state not found');
        }
        return this.#setNextState.setValue(true);
    }

    setPrevious(): Promise<void> {
        if (!this.#setPrevState) {
            throw new Error('Prev state not found');
        }
        return this.#setPrevState.setValue(true);
    }

    getShuffle(): boolean | undefined {
        if (!this.#shuffleState) {
            throw new Error('Shuffle state not found');
        }
        return this.#shuffleState.value;
    }

    setShuffle(value: boolean): Promise<void> {
        if (!this.#shuffleState) {
            throw new Error('Shuffle state not found');
        }
        return this.#shuffleState.setValue(value);
    }

    getRepeat(): number | undefined {
        if (!this.#repeatState) {
            throw new Error('Repeat state not found');
        }
        return this.#repeatState.value;
    }

    setRepeat(value: number): Promise<void> {
        if (!this.#repeatState) {
            throw new Error('Repeat state not found');
        }
        return this.#repeatState.setValue(value);
    }

    getArtist(): string | undefined {
        if (!this.#getArtistState) {
            throw new Error('Artist state not found');
        }
        return this.#getArtistState.value;
    }

    getAlbum(): string | undefined {
        if (!this.#getAlbumState) {
            throw new Error('Album state not found');
        }
        return this.#getAlbumState.value;
    }

    getTitle(): string | undefined {
        if (!this.#getTitleState) {
            throw new Error('Title state not found');
        }
        return this.#getTitleState.value;
    }

    getCover(): string | undefined {
        if (!this.#getCoverState) {
            throw new Error('Cover state not found');
        }
        return this.#getCoverState.value;
    }

    getDuration(): number | undefined {
        if (!this.#getDurationState) {
            throw new Error('Duration state not found');
        }
        return this.#getDurationState.value;
    }

    getElapsed(): number | undefined {
        if (!this.#getElapsedState) {
            throw new Error('Elapsed state not found');
        }
        return this.#getElapsedState.value;
    }

    setSeek(value: number): Promise<void> {
        if (!this.#setSeekState) {
            throw new Error('Seek state not found');
        }
        return this.#setSeekState.setValue(value);
    }

    getTrack(): string | undefined {
        if (!this.#getTrackState) {
            throw new Error('Track state not found');
        }
        return this.#getTrackState.value;
    }

    getEpisode(): string | undefined {
        if (!this.#getEpisodeState) {
            throw new Error('Episode state not found');
        }
        return this.#getEpisodeState.value;
    }

    getSeason(): string | undefined {
        if (!this.#getSeasonState) {
            throw new Error('Season state not found');
        }
        return this.#getSeasonState.value;
    }

    getVolume(): number | undefined {
        if (!this.#getVolumeState) {
            throw new Error('Volume state not found');
        }
        return this.#getVolumeState.value;
    }

    setVolume(value: number): Promise<void> {
        if (!this.#setVolumeState) {
            throw new Error('Volume state not found');
        }
        return this.#setVolumeState.setValue(value);
    }

    getMute(): boolean | undefined {
        if (!this.#muteState) {
            throw new Error('Mute state not found');
        }
        return this.#muteState.value;
    }

    setMute(value: boolean): Promise<void> {
        if (!this.#muteState) {
            throw new Error('Mute state not found');
        }
        return this.#muteState.setValue(value);
    }

    getConnected(): boolean | undefined {
        if (!this.#getConnectedState) {
            throw new Error('Connected state not found');
        }
        return this.#getConnectedState.value;
    }
}

export default Media;
