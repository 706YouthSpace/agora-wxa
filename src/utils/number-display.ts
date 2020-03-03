
export function humanReadableNumber(n: number | string) {

    let x = parseFloat(n as any);
    let currentUnit;
    const unitStack = ['B', 'M', 'k', ''];

    while (true) {
        currentUnit = unitStack.pop();
        if (currentUnit === undefined) {
            break;
        }
        const t = x / 1000;
        if (t < 1) {
            return `${currentUnit ? x.toFixed(1) : x}${currentUnit}`;
        }
        x = t;
    }

    return `${(x * 1000).toFixed(1)}${currentUnit}`;
}
