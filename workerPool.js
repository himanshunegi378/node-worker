const { CustomWorker } = require("./customWorker");
const { EventEmitter } = require("events");
const { v4 } = require("uuid");

const availableEvents = {
  output: "output",
};
class WorkerPool {
  #closeRequested;
  constructor(limit) {
    this.limit = limit;
    this.workers = [...Array(this.limit)].map(() => new CustomWorker());
    this.taskQueue = [];
    this.event = new EventEmitter();
    this.#closeRequested = null;
  }

  //   check for free workers and assisgn task to free worker
  #onTick = () => {
    if (this.taskQueue.length === 0) {
      if (
        this.#closeRequested &&
        this.workers.every((worker) => worker.status === "free")
      ) {
        this.workers.forEach((worker) => worker.terminate());
        this.#closeRequested();
        this.#closeRequested = null;
      }
      return;
    }
    const worker = this.workers.find((worker) => worker.status === "free");
    if (worker) {
      const task = this.taskQueue.shift();
      worker
        .func(task.func)
        .exec(...task.args)
        .then((output) => {
          task.resolve(output);
        })
        .catch((err) => {
          task.reject(err);
        })
        .finally(this.#onTick);
    }
  };

  func(func) {
    return {
      exec: (...args) => {
        return new Promise((resolve, reject) => {
          const task = {
            id: v4(),
            func,
            args,
            resolve,
            reject,
          };
          this.taskQueue.push(task);
          this.#onTick();
        });
      },
    };
  }

  async close() {
    if (this.#closeRequested) {
      throw new Error("Close already requested");
    }
    return new Promise((res) => {
      this.#closeRequested = res;
    });
  }
}

exports.WorkerPool = WorkerPool;
