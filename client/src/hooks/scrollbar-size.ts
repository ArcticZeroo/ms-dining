import { RefCountedValueNotifier } from '../util/events.ts';
import { useValueNotifier } from './events.ts';

class ScrollbarSizeNotifier extends RefCountedValueNotifier<number> {
    constructor() {
        super(0 /*defaultValue*/);
    }

    setup() {
        const outerElement = document.createElement('div');
        outerElement.style.visibility = 'hidden';
        outerElement.style.overflowY = 'scroll';

        const innerElement = document.createElement('div');
        outerElement.appendChild(innerElement);

        const updateValue = () => {
            this.value = outerElement.offsetWidth - innerElement.offsetWidth;
        }

        const resizeObserver = new ResizeObserver(updateValue);
        resizeObserver.observe(outerElement);

        window.addEventListener('resize', updateValue);
        document.body.appendChild(outerElement);

        updateValue();

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateValue);
            document.body.removeChild(outerElement);
            this.value = 0;
        };
    }
}

const scrollbarWidthNotifier = new ScrollbarSizeNotifier();

export const useScrollbarWidth = () => useValueNotifier(scrollbarWidthNotifier);