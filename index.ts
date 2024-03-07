class Worker<T = unknown,S=void> {
  constructor(private queue:AsyncIterable<T>,private callbackFn:(value:T)=>Promise<S>) {
    
  }
  public exec() {
    return new ReadableStream<S>({
      start:async (controller)=> {
        for await (const task of this.queue) {
          console.log("w exec:start",task)
          controller.enqueue(await this.callbackFn(task))
          console.log("w exec:end",task)
        }
      }
    })
  }
}

interface WorkerPoolOptions{
  maxConcurrency: number;
}
class WorkerPool<T = unknown,S=void> {
  private workers: Worker<T,S>[];
  constructor(queue: AsyncIterable<T> | Iterable<T>, callbackFn: (value: T) => Promise<S>, private options: WorkerPoolOptions) {
    if (Symbol.iterator in queue) {
      const asynchronousQueue = this.iterableToGenerator(queue);
      this.workers = [...new Array(this.options.maxConcurrency)].map(() => new Worker(asynchronousQueue, callbackFn))
      return;
    }
    this.workers = [...new Array(this.options.maxConcurrency)].map(()=>new Worker(queue,callbackFn))
  }

  private iterableToGenerator(i: Iterable<T>):AsyncIterable<T> {
    return async function* () {
      for (const val of i) {
        yield val;
      }
    }()
  }

  public exec() {
    return new ReadableStream<S>({
      start: async (controller) => {
        this.workers.forEach(async worker => {
          for await (const result of worker.exec()) {
            console.log("p start",result)
            controller.enqueue(result)
            console.log("p end",result)
          }
        })
      }
    })
  }
}

async function* generator() {
  let i = 0;
  while (i < 23) {
    await waitFor(1)
    console.log("g start")
    yield new Date();
    await waitFor(1)
    console.log("g end")
    i++
  }
}
const waitFor = async(seconds: number) => {
  await new Promise<null>((resolve) => {
    setTimeout(()=>resolve(null),seconds * 1000)
  })
}
const array = [...new Array(23)].map((_, i) =>i)
// const pool = new WorkerPool(array, async (val) => {
//   await waitFor(2);
//   return val;
// }, { maxConcurrency: 5 })
const pool = new WorkerPool(generator(), async (val) => {
  console.log("cb start",val)
  await waitFor(2);
  console.log("cb end",val)
  return val;
}, { maxConcurrency: 1 })
for await (const val of pool.exec()) {
  console.log('c start',val)
  await waitFor(1)
  console.log('c emd',val)
}
