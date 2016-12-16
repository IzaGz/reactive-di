// @flow
import type {
    ISource,
    IGetable,
    IContext,
    ICacheable,
    IPullable,
    ISourceMeta,
    IDisposable,
    IBaseHook,
    IDisposableCollection,
    ISourceStatus
} from './interfaces'
import DisposableCollection from './DisposableCollection'
import {setterKey} from './interfaces'
import SourceStatus from './SourceStatus'

export default class Source<V> {
    t: 1
    displayName: string
    id: number
    refs: number
    computeds: IDisposableCollection<ICacheable<*> & IDisposable>
    consumers: IDisposableCollection<IPullable>
    context: IContext
    status: ?ISource<ISourceStatus>
    cached: ?V

    _initialized: boolean
    _resolved: boolean
    _hook: IGetable<IBaseHook<V>>
    _configValue: ?V

    constructor(
        meta: ISourceMeta<V>,
        context: IContext
    ) {
        ;(this: ISource<V>) // eslint-disable-line
        this.t = 1
        this.refs = 0
        this._initialized = false
        this._resolved = false
        this.status = null
        this.computeds = new DisposableCollection()
        this.consumers = new DisposableCollection()
        this.displayName = meta.name
        this.id = meta.id
        this.context = context
        this._configValue = meta.configValue
        ;(meta.initialValue: any)[setterKey] = this // eslint-disable-line
        this.cached = meta.initialValue
        this._hook = this.context.resolveHook(meta.hook)
    }

    willMount(_parent: ?IContext): void {
        const hook = this._hook.cached || this._hook.get()
        if (hook.init && !this._initialized) {
            this._initialized = true
            hook.init(this.cached)
        }
        if (hook.willMount) {
            hook.willMount(this.cached)
        }
    }

    willUnmount(parent: ?IContext): void {
        const hook = this._hook.cached || this._hook.get()
        if (hook.willUnmount) {
            hook.willUnmount(this.cached)
        }
        if (hook.dispose && parent === this.context) {
            hook.dispose(this.cached)
            this._initialized = false
        }
    }

    resolve(): void {
        const init = !this._resolved
        this._resolved = true
        const {stack, level} = this.context.binder

        let source: ISource<any> = this
        let computeds = source.computeds
        let consumers = source.consumers

        let i = stack.length
        while (--i >= level) {
            const rec = stack[i]
            if (init || !rec.has[source.id]) {
                rec.v.masters.push(source)
                if (!init) {
                    rec.has[source.id] = true
                }
                if (rec.v.t === 0) {
                    // computed
                    computeds.push(rec.v)
                } else if (rec.v.t === 3) {
                    // status
                    source = this.status || this.getStatus()
                    computeds = source.computeds
                    consumers = source.consumers
                    computeds.push(rec.v)
                } else {
                    // consumer
                    consumers.push(rec.v)
                }
            }
        }
    }

    get(): V {
        throw new Error('Source always cached')
    }

    merge(props: mixed, flush?: boolean): void {
        this.set(
           Object.assign(
               Object.create((this.cached: any).prototype),
               (this.cached: any),
               props
           ),
           flush
       )
    }

    getStatus(): ISource<ISourceStatus> {
        if (!this.status) {
            const status: ISource<ISourceStatus> = new Source(
                ({
                    key: SourceStatus,
                    name: this.displayName + 'Status',
                    id: this.id - 1,
                    hook: null,
                    configValue: null,
                    initialValue: new SourceStatus('complete')
                }: ISourceMeta<ISourceStatus>),
                this.context
            )
            this.status = status.status = status
        }

        return this.status
    }

    set(v: V, flush?: boolean): void {
        if (v === this.cached) {
            return
        }
        const hook = this._hook.cached || this._hook.get()
        ;(v: any)[setterKey] = this // eslint-disable-line
        if (hook.shouldUpdate && !hook.shouldUpdate(v, this.cached)) {
            return
        }
        if (hook.willUpdate) {
            hook.willUpdate(v, this.cached)
        }
        const context = this.context
        if (context.middlewares) {
            context.middlewares.onSetValue(this, v)
        }
        this.cached = v

        const computeds = this.computeds.items
        for (let i = 0, l = computeds.length; i < l; i++) {
            computeds[i].cached = null
        }
        context.notifier.notify(this.consumers.items, flush)
    }
}
