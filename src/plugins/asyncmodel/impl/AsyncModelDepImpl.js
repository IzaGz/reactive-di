/* @flow */

import merge from '../../../utils/merge'
import EntityMetaImpl from '../EntityMetaImpl'
import {DepBaseImpl} from '../../../core/pluginImpls'
import type {
    DepId,
    Info
} from '../../../interfaces/annotationInterfaces'
import type {
    Notify,
    Cursor,
    FromJS
} from '../../../interfaces/modelInterfaces'
import type {
    Cacheable,
    DepBase
} from '../../../interfaces/nodeInterfaces'
import type {
    Subscription,
    Observable,
    Observer
} from '../../../interfaces/observableInterfaces'
import type {SetterDep} from '../../setter/setterInterfaces'
import type {
    EntityMeta,
    AsyncModelDep
} from '../asyncmodelInterfaces'

export function setPending<E>(meta: EntityMeta<E>): EntityMeta<E> {
    return merge(meta, {
        pending: true,
        rejected: false,
        fulfilled: false,
        reason: null
    })
}

export function setSuccess<E>(meta: EntityMeta<E>): EntityMeta<E> {
    return merge(meta, {
        pending: false,
        rejected: false,
        fulfilled: true,
        reason: null
    })
}

export function setError<E>(meta: EntityMeta<E>, reason: E): EntityMeta<E> {
    return merge(meta, {
        pending: false,
        rejected: true,
        fulfilled: false,
        reason
    })
}

type PromiseHandlers<V, E> = {
    success(value: V): void;
    error(error: E): void;
    promise: Promise<V>;
};

function noop() {}

function createPromiseHandlers<V, E>(): PromiseHandlers<V, E> {
    let success: (value: V) => void = noop;
    let error: (err: E) => void = noop;
    const promise = new Promise((resolve, reject) => {
        function onTimeout(): void {
            reject(new Error('Timeout error'))
        }
        const timerId: number = setTimeout(onTimeout, 10000);
        success = function successHandler(data: V): void {
            clearTimeout(timerId)
            resolve(data)
        }
        error = function errorHandler(err: E): void {
            clearTimeout(timerId)
            reject(err)
        }
    })

    return {promise, success, error}
}

// implements AsyncModelDep, Oserver
export default class AsyncModelDepImpl<V: Object, E> {
    kind: 'asyncmodel';
    base: DepBase;
    dataOwners: Array<Cacheable>;

    meta: EntityMeta<E>;
    metaOwners: Array<Cacheable>;
    promise: Promise<V>;

    isSubscribed: boolean;

    _cursor: Cursor<V>;
    _fromJS: FromJS<V>;
    _notify: Notify;

    _value: V;

    _subscription: ?Subscription;

    _error: (error: E) => void;
    _success: (value: V) => void;
    _promiseDone: boolean;

    constructor(
        id: DepId,
        info: Info,
        cursor: Cursor<V>,
        fromJS: FromJS<V>,
        notify: Notify
    ) {
        this.kind = 'asyncmodel'

        const base = this.base = new DepBaseImpl(id, info)
        this._cursor = cursor
        this._fromJS = fromJS
        this._notify = notify
        this._subscription = null
        this._error = noop
        this._success = noop

        this.dataOwners = []
        this.metaOwners = []
        this.meta = new EntityMetaImpl()
        this._promiseDone = true
        this._updatePromise()
        this.isSubscribed = false
    }

    _notifyMeta(): void {
        const {metaOwners} = this
        for (let i = 0, l = metaOwners.length; i < l; i++) {
            metaOwners[i].isRecalculate = true
        }
        this._notify()
    }

    _notifyData(): void {
        const {dataOwners} = this
        for (let i = 0, l = dataOwners.length; i < l; i++) {
            dataOwners[i].isRecalculate = true
        }
        this._notify()
    }

    _pending(): void {
        const newMeta: EntityMeta<E> = setPending(this.meta);
        if (this.meta === newMeta) {
            // if previous value is pending - do not handle this value: only first
            return
        }
        this.meta = newMeta
        this._notifyMeta()
    }

    unsubscribe(): void {
        if (this._subscription) {
            this._subscription.unsubscribe()
            this._subscription = null
            this.isSubscribed = false
        }
    }

    next(value: V): void {
        if (this._cursor.set(value)) {
            this._value = value
            this._notifyData()
        }
        const newMeta: EntityMeta<E> = setSuccess(this.meta);
        if (newMeta !== this.meta) {
            this.meta = newMeta
            this._notifyMeta()
        }
        this._success(value)
        this._promiseDone = true
    }

    error(errorValue: E): void {
        const newMeta: EntityMeta<E> = setError(this.meta, errorValue);
        this.unsubscribe()
        if (newMeta !== this.meta) {
            this.meta = newMeta
            this._notifyMeta()
        }
        this._error(errorValue)
        this._promiseDone = true
    }

    complete(completeValue?: V): void {
        this.unsubscribe()
    }

    _updatePromise(): void {
        if (!this._promiseDone) {
            return
        }
        this._promiseDone = false
        const {promise, error, success} = createPromiseHandlers()
        this.promise = promise
        this._error = error
        this._success = success
    }

    set(value: V|Observable<V, E>): void {
        this.unsubscribe()

        this._updatePromise()
        if (value.subscribe === 'function') {
            this._pending()
            this._subscription = (value: Observable<V, E>).subscribe((this: Observer<V, E>))
            this.isSubscribed = true
        } else {
            this.next(((value: any): V))
        }
    }

    setFromJS(data: Object): void {
        if (this._cursor.set(this._fromJS(data))) {
            this._notifyData()
        }
    }

    resolve(): V {
        const {base} = this
        if (!base.isRecalculate) {
            return this._value
        }
        base.isRecalculate = false
        this._value = this._cursor.get()

        return this._value
    }
}