// @flow
import type {Atom, Adapter} from 'reactive-di/interfaces/atom'

import {
    atom,
    isAtom,
    struct,
    transact
} from 'derivable'

export default ({
    atom,
    isAtom,
    transact,
    struct
}: Adapter)