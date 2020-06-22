# Reactive graph resolution algorithm:

- Watchable gathering:
  - functions in the environment, whether its *root level* user functions or functions hidden within `Derived` containers, mutate/notify watchables. each time a watchable is added to this round, all of its watchers need to have some sort of state transition
  - once all watchables are gathered we go through them all. (it seems that by the very nature of being placed in the queue, they are justifiably "pending". it seems this means that the only use for "pending" is to inform that watchable's watchers that the watchable isn't yet ready, so the watcher cannot run. this also means that the "pending" check in the watchable processing loop is pointless)
  - as we go through them, we finalize each, moving it into whatever state indicates to its watchers that it's ready to be used. we also add all the watchers of that watchable to the queue
  - since we disallow circular dependencies by both doing a liveness check in the later loop and not allowing mutation within user level functions (instead requiring them to use `Derived` in some way), we can guarantee (proof obligation?) that once we've processed all watchables within one tier, all the watchers that depended on them are truly ready to go
-


it seems that watchables can only be moved into their "pending" state by being "mutated" or in whatever way notified


This code shows us a couple of useful expectations of code within Watchable and Watcher.
Watchables are only allowed to "activate" their watchers in some way (and probably `Batch` should do that work instead!).
Watchers

checking for triggeredness in the watcher loop seems pointless? the fact that we're using a set seems like the better way to do that?
wasn't that originally for deduplication?
yes this seems true. by pure virtue of the fact that it's been added to the watcher queue means that it's been "triggered"

no, some concept of "triggering" a watcher is useful and neccessary, but only for `Derived` containers
it gives the watcher a chance to mark its internal watchable to pending,
so that any *watchers* that were also just added to this batch that depend on that internal watchable don't incorrectly believe that it's ready


```ts
// OLD
class Batch {
 run() {
   while (this.watchables.length > 0 || this.watchers.length > 0) {
     let watchable
     while (watchable = this.watchables.pop()) {
       // if (!watchable.pending()) continue
       watchable.finish()
       Array.prototype.unshift.apply(this.watchers, [...watchable.watchers()])
       continue
     }

     const nextWatchers = []
     let runCount = 0
     let watcher
     while (watcher = this.watchers.pop()) {
       if (!watcher.triggered()) continue

       if (!watcher.ready()) {
         nextWatchers.unshift(watcher)
         continue
       }

       runCount++
       // this action places more Watchables into the queue
       watcher.run()
     }

     this.watchers.splice(0, nextWatchers.length, ...nextWatchers)

     if (this.watchers.length > 0 && runCount === 0)
       throw new ReactivityPanic('circular reference')
   }
 }
}
```
