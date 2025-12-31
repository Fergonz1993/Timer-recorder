declare module 'asciichart' {
  const blue: string;
  const green: string;
  const red: string;
  const cyan: string;
  const magenta: string;
  const yellow: string;
  const white: string;
  const black: string;
  const reset: string;

  interface PlotConfig {
    height?: number;
    offset?: number;
    padding?: string;
    format?: (x: number) => string;
    colors?: string[];
  }

  function plot(series: number[] | number[][], config?: PlotConfig): string;

  export { blue, green, red, cyan, magenta, yellow, white, black, reset, plot, PlotConfig };
}
