declare module '*.mjs' {
  export function detectEmergency(text:string,locales:Record<string,{terms:string[];negations:string[]}>): {urgent:boolean;reasons:string[]};
}
