import {writable, get} from 'svelte/store';
import Polygon from "./shapes/Polygon.svelte";
import Rect from "./shapes/Rect.svelte";

export type ShapeType = "rect" | "polygon";

export const imageMeta = writable<{ w: number; h: number } | null>(null);

type Focuspoint = {[K in string]: string} & {
  __shape: ShapeType;
  __data: any;
}

type ShapeConfig = {
  component: Function;
  constructor(config: WizardConfig): object;
}

type WizardConfig = {
  defaultWidth?: string;
  defaultHeight?: string;
  itemFormElName?: string;
  typo3Version?: number;
  fields: {
    [K in string]: {
      displayCond?: string;
      default?: string;
      useAsName?: boolean | number | string;
      type?: string;
    }
  }
}

export const SHAPES: {[K in ShapeType]: ShapeConfig} = {
  rect: {
    component: Rect,
    constructor(config: WizardConfig): object {
      const meta = get(imageMeta);
      const wParsed = parseFloat(config.defaultWidth ?? "0");
      const hParsed = parseFloat(config.defaultHeight ?? "0");

      let width  = Number.isFinite(wParsed) && wParsed > 0 ? wParsed : (meta ? Math.round(meta.w * 0.25) : 200);
      let height = Number.isFinite(hParsed) && hParsed > 0 ? hParsed : (meta ? Math.round(meta.h * 0.25) : 150);

      width = Math.max(50, width);
      height = Math.max(50, height);

      let x = 20, y = 20;
      if (meta) {
        x = Math.round((meta.w - width) / 2);
        y = Math.round((meta.h - height) / 2);
        x = Math.max(0, Math.min(x, Math.max(0, meta.w - width)));
        y = Math.max(0, Math.min(y, Math.max(0, meta.h - height)));
      }

      return { x, y, width, height };
    }

  },
  polygon: {
    component: Polygon,
    constructor(): object {
      const meta = get(imageMeta);
      const size = meta ? Math.round(Math.min(meta.w, meta.h) * 0.2) : 200;
      const s = Math.max(20, size);

      let cx = 20 + s / 2;
      let cy = 20 + s / 2;
      if (meta) {
        cx = Math.round(meta.w / 2);
        cy = Math.round(meta.h / 2);
      }

      const half = Math.floor(s / 2);
      return {
        points: [
          [cx - half, cy - half],
          [cx + half, cy - half],
          [cx + half, cy + half],
          [cx - half, cy + half]
        ]
      };
    }

  }
};

export const wizardConfigStore = writable<WizardConfig>({fields: {}});

export const focuspoints = writable<Focuspoint[]>([]);

let activeIndex = $state(0);

export const initStores = (hiddenInput: HTMLInputElement, wizardConfig: string): void => {
    wizardConfigStore.set(JSON.parse(wizardConfig));
    focuspoints.set(JSON.parse(hiddenInput.value ? hiddenInput.value : '[]'));
}

/**
* Evaluate a condition, e.g. FIELD:name:REQ:true
*/
export const fieldMeetsCondition = (fieldName: string, point: {[K in string]: string}): boolean => {
    const condition = get(wizardConfigStore).fields[fieldName].displayCond;
    if (!condition) {
        return true;
    }

    const parts = condition.split(':');
    if (parts.length < 4 || parts[0] !== 'FIELD') {
        return true;
    }

    const [, field, operator, value] = parts;
    if (!Object.hasOwn(point, field)) {
        return true;
    }

    switch (operator) {
        case 'REQ':
            return point[field] !== null && point[field] !== '';
        case '!=':
            return point[field] !== value;
        case '=':
            return point[field] === value;
        case '>': {
            const pointVal = parseInt(point[field], 10);
            const compareVal = parseInt(value, 10);
            return !isNaN(pointVal) && !isNaN(compareVal) && pointVal > compareVal;
        }
        case '<': {
            const pointVal = parseInt(point[field], 10);
            const compareVal = parseInt(value, 10);
            return !isNaN(pointVal) && !isNaN(compareVal) && pointVal < compareVal;
        }
        case '>=': {
            const pointVal = parseInt(point[field], 10);
            const compareVal = parseInt(value, 10);
            return !isNaN(pointVal) && !isNaN(compareVal) && pointVal >= compareVal;
        }
        case '<=': {
            const pointVal = parseInt(point[field], 10);
            const compareVal = parseInt(value, 10);
            return !isNaN(pointVal) && !isNaN(compareVal) && pointVal <= compareVal;
        }
        case 'IN':
            return value.split(',').includes(point[field]);
        case '!IN':
            return !value.split(',').includes(point[field]);
        case '-': {
            const range = value.split('-');
            if (range.length !== 2) return false;
            const [min, max] = range;
            const pointVal = parseInt(point[field], 10);
            return !isNaN(pointVal) && pointVal >= parseInt(min, 10) && pointVal <= parseInt(max, 10);
        }
        case '!-': {
            const range = value.split('-');
            if (range.length !== 2) return false;
            const [min, max] = range;
            const pointVal = parseInt(point[field], 10);
            return !isNaN(pointVal) && (pointVal < parseInt(min, 10) || pointVal > parseInt(max, 10));
        }
        default:
            return false;
    }
}

export const createNewFocuspoint = (shape: ShapeType): void => {
    const config = get(wizardConfigStore);

    // create a new focuspoint with default fields
    const newFocuspoint: any = Object.keys(config.fields).reduce((acc: any, key) => {
      acc[key] = config.fields[key].default ?? null;
      return acc;
    }, {});

    newFocuspoint.__shape = shape;
    newFocuspoint.__data = SHAPES[shape].constructor(config);

    // add the new focuspoint to the store and activate it
    focuspoints.update(focuspoints => [...focuspoints, newFocuspoint]);
    activeIndex = get(focuspoints).length - 1;
}

export const setActiveIndex = (index: number) => {
  activeIndex = index;
}

export const getActiveIndex = (): number => {
  return activeIndex;
}

export const focusPointName = (index: number) => {
    const config = get(wizardConfigStore);
    const nameFields = Object.entries(config.fields).filter(([key, value]) => {
        return value['useAsName'] === true || value['useAsName'] === 'true' || value['useAsName'] === '1' || value['useAsName'] === 1;
    }).map(([key, value]) => {
        return key;
    });


    const defaultName = 'Focus Point ' + (index + 1);
    if (nameFields.length === 0) {
        return defaultName;
    }

    const store = get(focuspoints);
    const names = Object.entries(store[index]).filter(([key, value]) => { return nameFields.includes(key) && value !== null && value !== '' }).map(([key, value]) => { return value })
    if (names.length === 0) {
        return defaultName;
    }

    return names.join(', ');
}
