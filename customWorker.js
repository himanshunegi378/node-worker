const { Worker } = require("worker_threads");
const workerString = `const { workerData, parentPort, isMainThread } = require("worker_threads");
    let inputFunc;
parentPort.on("message", (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === "function") {
        inputFunc = eval(parsedData.value)
    }
    if (parsedData.type === "args") {
        const output = inputFunc(...parsedData.value);
        parentPort.postMessage(output);
    }
    
});`;
const workerStatus = {
  free: "free",
  busy: "busy",
};

exports.CustomWorker = class CustomWorker {
  #status = workerStatus.free;
  #worker = new Worker(workerString, { eval: true });
  constructor() {}
  func(func) {
    if (!this.#worker) this.#worker = new Worker(workerString, { eval: true });
    this.#worker.postMessage(
      JSON.stringify({ type: "function", value: func.toString() })
    );
    return {
      exec: this.#exec,
    };
  }

  get status() {
    return this.#status;
  }

  #exec = (...args) => {
    return new Promise((resolve, reject) => {
      if (this.#status === workerStatus.busy) {
        reject("Worker is busy");
      }
      this.#status = workerStatus.busy;

      this.#worker
        .on("message", (message) => {
          this.#status = workerStatus.free;
          resolve(message);
        })
        .on("error", (err) => {
          this.#status = workerStatus.free;
          reject(err);
        })
        .postMessage(JSON.stringify({ type: "args", value: args }));
    });
  };
  terminate() {
    this.#worker.terminate();
    this.#worker = null;
  }
};
