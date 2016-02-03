/* @flow */

import type {
    Deps,
    DepFn,
    AnnotationBase,
    Dependency
} from '../../interfaces/annotationInterfaces'
import type {DepBase, DepArgs} from '../../interfaces/nodeInterfaces'
import type {Observable} from '../../interfaces/observableInterfaces'
import type {AnyUpdater} from '../asyncmodel/asyncmodelInterfaces'
import type {ModelDep} from '../model/modelInterfaces'
import type {
    FactoryInvoker,
    FactoryDep,
    Invoker
} from '../factory/factoryInterfaces'
import type {MetaDep} from '../meta/metaInterfaces'

export type SetFn = (...args: any) => void;
export type SetterDep = {
    kind: 'setter';
    base: DepBase;
    resolve(): SetFn;
}

export type SetterAnnotation<V: Object, E> = {
    kind: 'setter';
    base: AnnotationBase<AnyUpdater<V, E>>;
    deps: ?Deps;
    model: Class<V>;
}
