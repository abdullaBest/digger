enum MapEventCode {
	DEFAULT = 0,
	START = 1,
	END = 2,
}

interface MapEvent {
	component: string;
	code: MapEventCode;
	tag?: string;
}

export default MapEvent;
export { MapEvent, MapEventCode };

