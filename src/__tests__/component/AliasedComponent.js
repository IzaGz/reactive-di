// @flow
/* eslint-env mocha */

import {spy, match} from 'sinon'
import assert from 'power-assert'

import React from 'react'
import ReactDOM from 'react-dom/server'

import {
    abstract,
    cloneComponent,
    theme,
    component,
    source,
    deps
} from 'reactive-di/annotations'

import type {StyleSheet} from 'reactive-di/interfaces/component'

import {Component} from 'fake-react'
import Di from 'reactive-di/core/Di'
import BaseModel from 'reactive-di/utils/BaseModel'

import ReactComponentFactory from 'reactive-di/adapters/ReactComponentFactory'

import {renderIntoDocument} from 'react-addons-test-utils'
import {findDOMNode} from 'react-dom'

function render(raw) {
    return renderIntoDocument(React.createElement(raw))
}

describe('AliasedComponentTest', () => {
    type ModelARec = {
        val?: string;
    }

    it('render via state changes', () => {
        // @source({key: 'Test'})
        @abstract
        class Test extends BaseModel<ModelARec> {
            val: string
            static defaults: ModelARec = {
                val: 'Test'
            }
        }

        function TestComponent(props: {}, state: {m: Test}, h) {
            return <div>{state.m.val}</div>
        }
        deps({m: Test})(TestComponent)
        component()(TestComponent)

        @source({key: 'TestA'})
        class TestA extends Test {
            static defaults: ModelARec = {
                val: 'TestA'
            }
        }

        @source({key: 'TestB'})
        class TestB extends Test{
            static defaults: ModelARec = {
                val: 'TestB'
            }
        }

        const TestComponentA = cloneComponent(TestComponent, {
            register: [
                [Test, TestA]
            ]
        })

        const TestComponentB = cloneComponent(TestComponent, {
            register: [
                [Test, TestB]
            ]
        })

        function Main(props: {}, s, h) {
            return <div>{s.a.val}/{s.b.val}, <TestComponentA/>-<TestComponentB/></div>
        }
        deps({a: TestA, b: TestB})(Main)
        component({
            register: [
                TestComponentA,
                TestComponentB,
                // TestA,
                TestB
            ]
        })(Main)

        const di = new Di(new ReactComponentFactory(React)).register([TestA])

        const MainEl = di.wrapComponent(Main)
        di.val(TestA).set(new TestA({val: 'TestA2'}))
        const main = render(MainEl)
        assert(findDOMNode(main).textContent === 'TestA2/TestB, TestA2-TestB')
    })
})
