/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

// TODO: All these warnings should become static errors using Flow instead
// of dynamic errors when using JSX with Flow.
var React;
var ReactDOM;
var ReactTestUtils;
var PropTypes;

describe('ReactJSXElementValidator', () => {
  function normalizeCodeLocInfo(str) {
    return str && str.replace(/at .+?:\d+/g, 'at **');
  }

  var Component;
  var RequiredPropComponent;

  beforeEach(() => {
    jest.resetModules();

    PropTypes = require('prop-types');
    React = require('react');
    ReactDOM = require('react-dom');
    ReactTestUtils = require('react-dom/test-utils');

    Component = class extends React.Component {
      render() {
        return <div />;
      }
    };

    RequiredPropComponent = class extends React.Component {
      render() {
        return <span>{this.props.prop}</span>;
      }
    };
    RequiredPropComponent.displayName = 'RequiredPropComponent';
    RequiredPropComponent.propTypes = {prop: PropTypes.string.isRequired};
  });

  it('warns for keys for arrays of elements in children position', () => {
    spyOn(console, 'error');

    ReactTestUtils.renderIntoDocument(
      <Component>{[<Component />, <Component />]}</Component>,
    );

    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.argsFor(0)[0]).toContain(
      'Each child in an array or iterator should have a unique "key" prop.',
    );
  });

  it('warns for keys for arrays of elements with owner info', () => {
    spyOn(console, 'error');

    class InnerComponent extends React.Component {
      render() {
        return <Component>{this.props.childSet}</Component>;
      }
    }

    class ComponentWrapper extends React.Component {
      render() {
        return <InnerComponent childSet={[<Component />, <Component />]} />;
      }
    }

    ReactTestUtils.renderIntoDocument(<ComponentWrapper />);

    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.argsFor(0)[0]).toContain(
      'Each child in an array or iterator should have a unique "key" prop.' +
        '\n\nCheck the render method of `InnerComponent`. ' +
        'It was passed a child from ComponentWrapper. ',
    );
  });

  it('warns for fragments with illegal attributes', () => {
    spyOn(console, 'error');

    class Foo extends React.Component {
      render() {
        return <React.Fragment a={1} b={2}>hello</React.Fragment>;
      }
    }

    ReactTestUtils.renderIntoDocument(<Foo />);

    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.argsFor(0)[0]).toContain('Invalid prop `');
    expectDev(console.error.calls.argsFor(0)[0]).toContain(
      '` supplied to `React.Fragment`. React.Fragment ' +
        'can only have `key` and `children` props.',
    );
  });

  it('warns for fragments with refs', () => {
    spyOn(console, 'error');

    class Foo extends React.Component {
      render() {
        return (
          <React.Fragment
            ref={bar => {
              this.foo = bar;
            }}>
            hello
          </React.Fragment>
        );
      }
    }

    ReactTestUtils.renderIntoDocument(<Foo />);

    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.argsFor(0)[0]).toContain(
      'Invalid attribute `ref` supplied to `React.Fragment`.',
    );
  });

  it('warns for keys for iterables of elements in rest args', () => {
    spyOn(console, 'error');

    var iterable = {
      '@@iterator': function() {
        var i = 0;
        return {
          next: function() {
            var done = ++i > 2;
            return {value: done ? undefined : <Component />, done: done};
          },
        };
      },
    };

    ReactTestUtils.renderIntoDocument(<Component>{iterable}</Component>);

    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.argsFor(0)[0]).toContain(
      'Each child in an array or iterator should have a unique "key" prop.',
    );
  });

  it('does not warn for fragments of multiple elements without keys', () => {
    ReactTestUtils.renderIntoDocument(
      <React.Fragment>
        <span>1</span>
        <span>2</span>
      </React.Fragment>,
    );
  });

  it('warns for fragments of multiple elements with same key', () => {
    spyOn(console, 'error');

    ReactTestUtils.renderIntoDocument(
      <React.Fragment>
        <span key="a">1</span>
        <span key="a">2</span>
        <span key="b">3</span>
      </React.Fragment>,
    );

    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.argsFor(0)[0]).toContain(
      'Encountered two children with the same key, `a`.',
    );
  });

  it('does not warn for arrays of elements with keys', () => {
    spyOn(console, 'error');

    ReactTestUtils.renderIntoDocument(
      <Component>{[<Component key="#1" />, <Component key="#2" />]}</Component>,
    );

    expectDev(console.error.calls.count()).toBe(0);
  });

  it('does not warn for iterable elements with keys', () => {
    spyOn(console, 'error');

    var iterable = {
      '@@iterator': function() {
        var i = 0;
        return {
          next: function() {
            var done = ++i > 2;
            return {
              value: done ? undefined : <Component key={'#' + i} />,
              done: done,
            };
          },
        };
      },
    };

    ReactTestUtils.renderIntoDocument(<Component>{iterable}</Component>);

    expectDev(console.error.calls.count()).toBe(0);
  });

  it('does not warn for numeric keys in entry iterable as a child', () => {
    spyOn(console, 'error');

    var iterable = {
      '@@iterator': function() {
        var i = 0;
        return {
          next: function() {
            var done = ++i > 2;
            return {value: done ? undefined : [i, <Component />], done: done};
          },
        };
      },
    };
    iterable.entries = iterable['@@iterator'];

    ReactTestUtils.renderIntoDocument(<Component>{iterable}</Component>);

    expectDev(console.error.calls.count()).toBe(0);
  });

  it('does not warn when the element is directly as children', () => {
    ReactTestUtils.renderIntoDocument(
      <Component>
        <Component />
        <Component />
      </Component>,
    );
  });

  it('does not warn when the child array contains non-elements', () => {
    void <Component>{[{}, {}]}</Component>;
  });

  it('should give context for PropType errors in nested components.', () => {
    // In this test, we're making sure that if a proptype error is found in a
    // component, we give a small hint as to which parent instantiated that
    // component as per warnings about key usage in ReactElementValidator.
    spyOn(console, 'error');
    class MyComp extends React.Component {
      render() {
        return <div>My color is {this.color}</div>;
      }
    }
    MyComp.propTypes = {
      color: PropTypes.string,
    };
    class ParentComp extends React.Component {
      render() {
        return <MyComp color={123} />;
      }
    }
    ReactTestUtils.renderIntoDocument(<ParentComp />);
    expect(normalizeCodeLocInfo(console.error.calls.argsFor(0)[0])).toBe(
      'Warning: Failed prop type: ' +
        'Invalid prop `color` of type `number` supplied to `MyComp`, ' +
        'expected `string`.\n' +
        '    in MyComp (at **)\n' +
        '    in ParentComp (at **)',
    );
  });

  it('should update component stack after receiving next element', () => {
    spyOn(console, 'error');
    function MyComp() {
      return null;
    }
    MyComp.propTypes = {
      color: PropTypes.string,
    };
    function MiddleComp(props) {
      return <MyComp color={props.color} />;
    }
    function ParentComp(props) {
      if (props.warn) {
        // This element has a source thanks to JSX.
        return <MiddleComp color={42} />;
      }
      // This element has no source.
      return React.createElement(MiddleComp, {color: 'blue'});
    }

    var container = document.createElement('div');
    ReactDOM.render(<ParentComp warn={false} />, container);
    ReactDOM.render(<ParentComp warn={true} />, container);

    expect(console.error.calls.count()).toBe(1);
    // The warning should have the full stack with line numbers.
    // If it doesn't, it means we're using information from the old element.
    expect(normalizeCodeLocInfo(console.error.calls.argsFor(0)[0])).toBe(
      'Warning: Failed prop type: ' +
        'Invalid prop `color` of type `number` supplied to `MyComp`, ' +
        'expected `string`.\n' +
        '    in MyComp (at **)\n' +
        '    in MiddleComp (at **)\n' +
        '    in ParentComp (at **)',
    );
  });

  it('gives a helpful error when passing null, undefined, or boolean', () => {
    var Undefined = undefined;
    var Null = null;
    var True = true;
    var Div = 'div';
    spyOn(console, 'error');
    void <Undefined />;
    void <Null />;
    void <True />;
    expectDev(console.error.calls.count()).toBe(3);
    expectDev(normalizeCodeLocInfo(console.error.calls.argsFor(0)[0])).toBe(
      'Warning: React.createElement: type is invalid -- expected a string ' +
        '(for built-in components) or a class/function (for composite ' +
        'components) but got: undefined. You likely forgot to export your ' +
        "component from the file it's defined in." +
        '\n\nCheck your code at **.',
    );
    expectDev(normalizeCodeLocInfo(console.error.calls.argsFor(1)[0])).toBe(
      'Warning: React.createElement: type is invalid -- expected a string ' +
        '(for built-in components) or a class/function (for composite ' +
        'components) but got: null.' +
        '\n\nCheck your code at **.',
    );
    expectDev(normalizeCodeLocInfo(console.error.calls.argsFor(2)[0])).toBe(
      'Warning: React.createElement: type is invalid -- expected a string ' +
        '(for built-in components) or a class/function (for composite ' +
        'components) but got: boolean.' +
        '\n\nCheck your code at **.',
    );
    void <Div />;
    expectDev(console.error.calls.count()).toBe(3);
  });

  it('should check default prop values', () => {
    spyOn(console, 'error');

    RequiredPropComponent.defaultProps = {prop: null};

    ReactTestUtils.renderIntoDocument(<RequiredPropComponent />);

    expectDev(console.error.calls.count()).toBe(1);
    expect(normalizeCodeLocInfo(console.error.calls.argsFor(0)[0])).toBe(
      'Warning: Failed prop type: The prop `prop` is marked as required in ' +
        '`RequiredPropComponent`, but its value is `null`.\n' +
        '    in RequiredPropComponent (at **)',
    );
  });

  it('should not check the default for explicit null', () => {
    spyOn(console, 'error');

    ReactTestUtils.renderIntoDocument(<RequiredPropComponent prop={null} />);

    expectDev(console.error.calls.count()).toBe(1);
    expect(normalizeCodeLocInfo(console.error.calls.argsFor(0)[0])).toBe(
      'Warning: Failed prop type: The prop `prop` is marked as required in ' +
        '`RequiredPropComponent`, but its value is `null`.\n' +
        '    in RequiredPropComponent (at **)',
    );
  });

  it('should check declared prop types', () => {
    spyOn(console, 'error');

    ReactTestUtils.renderIntoDocument(<RequiredPropComponent />);
    ReactTestUtils.renderIntoDocument(<RequiredPropComponent prop={42} />);

    expectDev(console.error.calls.count()).toBe(2);
    expect(normalizeCodeLocInfo(console.error.calls.argsFor(0)[0])).toBe(
      'Warning: Failed prop type: ' +
        'The prop `prop` is marked as required in `RequiredPropComponent`, but ' +
        'its value is `undefined`.\n' +
        '    in RequiredPropComponent (at **)',
    );

    expect(normalizeCodeLocInfo(console.error.calls.argsFor(1)[0])).toBe(
      'Warning: Failed prop type: ' +
        'Invalid prop `prop` of type `number` supplied to ' +
        '`RequiredPropComponent`, expected `string`.\n' +
        '    in RequiredPropComponent (at **)',
    );

    ReactTestUtils.renderIntoDocument(<RequiredPropComponent prop="string" />);

    // Should not error for strings
    expectDev(console.error.calls.count()).toBe(2);
  });

  it('should warn on invalid prop types', () => {
    // Since there is no prevalidation step for ES6 classes, there is no hook
    // for us to issue a warning earlier than element creation when the error
    // actually occurs. Since this step is skipped in production, we should just
    // warn instead of throwing for this case.
    spyOn(console, 'error');
    class NullPropTypeComponent extends React.Component {
      render() {
        return <span>{this.props.prop}</span>;
      }
    }
    NullPropTypeComponent.propTypes = {
      prop: null,
    };
    ReactTestUtils.renderIntoDocument(<NullPropTypeComponent />);
    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.argsFor(0)[0]).toContain(
      'NullPropTypeComponent: prop type `prop` is invalid; it must be a ' +
        'function, usually from the `prop-types` package,',
    );
  });

  it('should warn on invalid context types', () => {
    spyOn(console, 'error');
    class NullContextTypeComponent extends React.Component {
      render() {
        return <span>{this.props.prop}</span>;
      }
    }
    NullContextTypeComponent.contextTypes = {
      prop: null,
    };
    ReactTestUtils.renderIntoDocument(<NullContextTypeComponent />);
    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.argsFor(0)[0]).toContain(
      'NullContextTypeComponent: context type `prop` is invalid; it must ' +
        'be a function, usually from the `prop-types` package,',
    );
  });

  it('should warn if getDefaultProps is specificed on the class', () => {
    spyOn(console, 'error');
    class GetDefaultPropsComponent extends React.Component {
      render() {
        return <span>{this.props.prop}</span>;
      }
    }
    GetDefaultPropsComponent.getDefaultProps = () => ({
      prop: 'foo',
    });
    ReactTestUtils.renderIntoDocument(<GetDefaultPropsComponent />);
    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.argsFor(0)[0]).toContain(
      'getDefaultProps is only used on classic React.createClass definitions.' +
        ' Use a static property named `defaultProps` instead.',
    );
  });
});
