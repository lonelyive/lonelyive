// /// <reference types="vite/client" />

declare module '*?worker' {
  class WebWorker extends Worker {
    constructor();
  }
  export default WebWorker;
}

declare module '*?worker&inline' {
  class WebWorker extends Worker {
    constructor();
  }
  export default WebWorker;
}

// Add JSON module declaration
declare module '*.json' {
  const value: any;
  export default value;
}