/* @flow */

import type {FromJS, DepId} from '../interfaces'
import type {StateModelMeta, DepIdGetter} from './interfaces'
import EntityMeta from '../promised/EntityMeta'

export class StateDepsMeta {
    depMap: {[id: DepId]: Array<DepId>};
    parentMap: {[id: DepId]: Array<DepId>};
    pathMap: {[id: DepId]: Array<string>};
    fromJSMap: {[id: DepId]: FromJS};
    metaMap: {[id: DepId]: EntityMeta};
    childMap: {[id: DepId]: Array<DepId>};
    constructor() {
        this.depMap = {}
        this.parentMap = {}
        this.pathMap = {}
        this.fromJSMap = {}
        this.metaMap = {}
        this.childMap = {}
    }
}

type PropCreatorMap = {[prop: string]: Function};
/* eslint-disable no-undef */
function createFromJS<T: Object>(Proto: Class<T>, propCreators: PropCreatorMap): FromJS<T> {
/* eslint-enable no-undef */
    return function fromJS<R: Object>(data: R): T {
        const keys = Object.keys(data)
        const props = {}
        for (let i = 0, l = keys.length; i < l; i++) {
            const key = keys[i]
            const value = data[key]
            props[key] = propCreators[key] ? propCreators[key](value) : value;
        }
        return new Proto(props)
    }
}

function getPathIds(
    obj: StateModelMeta,
    path: Array<string>,
    parents: Array<DepId>,
    meta: StateDepsMeta,
    getDepId: DepIdGetter,
): FromJS<StateModelMeta> {
    const {depMap, pathMap, parentMap, fromJSMap, metaMap, childMap} = meta
    const id = getDepId(obj)

    metaMap[id] = new EntityMeta()
    childMap[id] = []

    pathMap[id] = path
    // write all parents and self to affect ids map
    depMap[id] = parents.concat([id])

    // write all child to self, to build EntityMeta deps
    parentMap[id] = [].concat(parents)
    // write self to all parents affect ids map
    // parents knowns about childs

    const l = parents.length - 1
    for (let k = 0; k <= l; k++) {
        const parentId: DepId = parents[k];
        depMap[parentId].push(id)
    }
    if (l >= 0) {
        childMap[parents[l]].push(id)
    }

    parents.push(id)
    const keys: Array<string> = Object.keys(obj);
    const propCreators: PropCreatorMap = {};
    for (let i = 0, j = keys.length; i < j; i++) {
        const key: string = keys[i];
        const prop: StateModelMeta = obj[key];
        if (prop !== null && typeof prop === 'object' && getDepId(prop)) {
            propCreators[key] = getPathIds(prop, path.concat(key), parents, meta, getDepId)
        }
    }
    parents.pop()

    const fromJS = createFromJS(obj.constructor, propCreators)
    fromJSMap[id] = fromJS

    return fromJS
}

export default function createDepMetaFromState(
    obj: StateModelMeta,
    getDepId: DepIdGetter
): StateDepsMeta {
    if (obj === null || typeof obj !== 'object') {
        throw new TypeError('Not an object: ' + String(obj))
    }

    const stateDepsMeta = new StateDepsMeta()
    getPathIds(obj, [], [], stateDepsMeta, getDepId)

    return stateDepsMeta
}
