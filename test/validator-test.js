var assert = require('assert'),
    vows = require('vows'),
    validator = require('../lib').validator,
    mixin = require('../lib').mixin;

function clone(object) {
  return Object.keys(object).reduce(function (obj, k) {
    obj[k] = object[k];
    return obj;
  }, {});
};


function assertInvalid(res) {
  console.log(">>> res.stack: ", res.stack);
  assert.isObject(res);
  assert.strictEqual(res.valid, false);
}

function assertValid(res) {
  assert.isObject(res);
  assert.strictEqual(res.valid, true);
}

function assertHasError(attr, field) {
  return function (res) {
    assert.notEqual(res.errors.length, 0);
    assert.ok(res.errors.some(function (e) {
      return e.attribute === attr && (field ? e.property === field : true);
    }));
  };
}

function assertHasErrorMsg(attr, msg) {
  return function (res) {
    assert.notEqual(res.errors.length, 0);
    assert.ok(res.errors.some(function (e) {
      return e.attribute === attr && e.message === msg;
    }));
  };
}

var _schemaId = 1;
function assertValidates(passingValue, failingValue, attributes) {
  var schema = {
    name: 'Resource',
    properties: { field: {} }
  };

  var failing;

  if (!attributes) {
    attributes = failingValue;
    failing = false;
  } else {
    failing = true;
  }

  var attr = Object.keys(attributes)[0];
  mixin(schema.properties.field, attributes);

  var result = {
    "when the object conforms": {
      topic: function () {
        var schemaId = _schemaId++;
        validator.add(schemaId, schema);
        return validator.validate({ field: passingValue }, schemaId);
      },
      "return an object with `valid` set to true": assertValid
    }
  };

  if (failing) {
    result["when the object does not conform"] ={
      topic: function () {
        var schemaId = _schemaId++;
        validator.add(schemaId, schema);
        return validator.validate({ field: failingValue }, schemaId);
      },
      "return an object with `valid` set to false": assertInvalid,
      "and an error concerning the attribute":      assertHasError(Object.keys(attributes)[0], 'field')
    };
  };

  return result;
}

function validate(obj, schema) {
  var schemaId = _schemaId++;
  validator.add(schemaId, schema);
  return validator.validate(obj, schemaId);
};

vows.describe('validator', {
  "Validating": {
    "with <type>:'string'":       assertValidates ('hello',   42,        { type: "string" }),
    "with <type>:'number'":       assertValidates (42,       'hello',    { type: "number" }),
    "with <type>:'integer'":      assertValidates (42,        42.5,      { type: "integer" }),
    "with <type>:'array'":        assertValidates ([4, 2],   'hi',       { type: "array" }),
    "with <type>:'object'":       assertValidates ({},        [],        { type: "object" }),
    "with <type>:'boolean'":      assertValidates (false,     42,        { type: "boolean" }),
    "with <types>:bool,num":      assertValidates (false,     'hello',   { type: ["boolean", "number"] }),
    "with <types>:bool,num":      assertValidates (544,       null,      { type: ["boolean", "number"] }),
    "with <type>:'null'":         assertValidates (null,      false,     { type: "null" }),
    "with <type>:'any'":          assertValidates (9,                    { type: "any" }),
    "with <pattern>":             assertValidates ("kaboom", "42",       { pattern: /^[a-z]+$/ }),
    "with <maxLength>":           assertValidates ("boom",   "kaboom",   { maxLength: 4 }),
    "with <minLength>":           assertValidates ("kaboom", "boom",     { minLength: 6 }),
    "with <minimum>":             assertValidates ( 512,      43,        { minimum:   473 }),
    "with <maximum>":             assertValidates ( 512,      1949,      { maximum:   678 }),
    "with <divisibleBy>":         assertValidates ( 10,       9,         { divisibleBy: 5 }),
    "with <divisibleBy> decimal": assertValidates ( 0.2,      0.009,     { divisibleBy: 0.01 }),
    "with <enum>":                assertValidates ("orange",  "cigar",   { enum: ["orange", "apple", "pear"] }),
    "with <format>:'url'":        assertValidates ('http://test.com/', 'hello', { format: 'url' }),
    "with <dependencies>": {
      topic: {
        properties: {
          town:    { dependencies: "country" },
          country: { }
        }
      },
      "when the object conforms": {
        topic: function (schema) {
          return validate({town: "luna", country: "moon"}, schema);
        },
        "return an object with `valid` set to true": assertValid
      },
      "when the object does not conform": {
        topic: function (schema) {
          return validator.validate({ town: "luna" }, schema);
        },
        "return an object with `valid` set to false": assertInvalid,
        "and an error concerning the attribute":      assertHasError('dependencies')
      }
    },
    "with <dependencies> as array": {
      topic: {
        properties: {
          town:    { dependencies: ["country", "planet"] },
          country: { },
          planet: { }
        }
      },
      "when the object conforms": {
        topic: function (schema) {
          return validator.validate({ town: "luna", country: "moon", planet: "mars" }, schema);
        },
        "return an object with `valid` set to true": assertValid
      },
      "when the object does not conform": {
        topic: function (schema) {
          return validator.validate({ town: "luna", planet: "mars" }, schema);
        },
        "return an object with `valid` set to false": assertInvalid,
        "and an error concerning the attribute":      assertHasError('dependencies')
      }
    },
    "with <dependencies> as schema": {
      topic: {
        properties: {
          town:    {
            type: 'string',
            dependencies: {
              properties: { x: { type: "number" } }
            }
          },
          country: { }
        }
      },
      "when the object conforms": {
        topic: function (schema) {
          return validator.validate({ town: "luna", x: 1 }, schema);
        },
        "return an object with `valid` set to true": assertValid,
      },
      "when the object does not conform": {
        topic: function (schema) {
          return validator.validate({ town: "luna", x: 'no' }, schema);
        },
        "return an object with `valid` set to false": assertInvalid
      }
    },
    "with <type>:'integer' and": {
      "<minimum> constraints":      assertValidates ( 512,      43,        { minimum:   473, type: 'integer' }),
      "<maximum> constraints":      assertValidates ( 512,      1949,      { maximum:   678, type: 'integer' }),
      "<divisibleBy> constraints":  assertValidates ( 10,       9,         { divisibleBy: 5, type: 'integer' })
    },
    "with <additionalProperties>:false": {
      topic: {
        properties: {
          town: { type: 'string' }
        },
        additionalProperties: false
      },
      "when the object conforms": {
        topic: function (schema) {
          return validator.validate({ town: "luna" }, schema);
        },
        "return an object with `valid` set to true": assertValid
      },
      "when the object does not conform": {
        topic: function (schema) {
          return validator.validate({ town: "luna", area: 'park' }, schema);
        },
        "return an object with `valid` set to false": assertInvalid
      }
    },
    "with option <additionalProperties>:false": {
      topic: {
        properties: {
          town: { type: 'string' }
        }
      },
      "when the object conforms": {
        topic: function (schema) {
          return validator.validate({ town: "luna" }, schema, {additionalProperties: false});
        },
        "return an object with `valid` set to true": assertValid
      },
      "when the object does not conform": {
        topic: function (schema) {
          return validator.validate({ town: "luna", area: 'park' }, schema, {additionalProperties: false});
        },
        "return an object with `valid` set to false": assertInvalid
      },
      "but overridden to true at schema": {
        topic: {
          properties: {
            town: { type: 'string' }
          },
          additionalProperties: true
        },
        "when the object does not conform": {
          topic: function (schema) {
            return validator.validate({ town: "luna", area: 'park' }, schema, {additionalProperties: false});
          },
          "return an object with `valid` set to true": assertValid
        }
      }
    }
  }
}).addBatch({
  "A schema": {
    topic: {
      name: 'Article',
      properties: {
        title: {
          type: 'string',
          maxLength: 140,
          conditions: {
            optional: function () {
              return !this.published;
            }
          }
        },
        date: { type: 'string', format: 'date', messages: { format: "must be a valid %{expected} and nothing else" } },
        body: { type: 'string' },
        tags: {
          type: 'array',
          uniqueItems: true,
          minItems: 2,
          items: {
            type: 'string',
            pattern: /[a-z ]+/
          }
        },
        tuple: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: {
            type: ['string', 'number']
          }
        },
        author:    { type: 'string', pattern: /^[\w ]+$/i, required: true, messages: { required: "is essential for survival" } },
        published: { type: 'boolean', 'default': false },
        category:  { type: 'string' },
        palindrome: {type: 'string', conform: function(val) {
          return val == val.split("").reverse().join(""); }
        }
      },
      patternProperties: {
        '^_': {
          type: 'boolean', default: false
        }
      }
    },
    "and an object": {
      topic: {
        title:    'Gimme some Gurus',
        date:     '2012-02-04',
        body:     "And I will pwn your codex.",
        tags:     ['energy drinks', 'code'],
        tuple:    ['string0', 103],
        author:   'cloudhead',
        published: true,
        category: 'misc',
        palindrome: 'dennis sinned',
        _flag: true
      },
      "can be validated with `validator.validate`": {
        "and if it conforms": {
          topic: function (object, schema) {
            return validator.validate(object, schema);
          },
          "return an object with the `valid` property set to true": assertValid,
          "return an object with the `errors` property as an empty array": function (res) {
            assert.isArray(res.errors);
            assert.isEmpty(res.errors);
          }
        },
        "and if it has a missing required property": {
          topic: function (object, schema) {
            object = clone(object);
            delete object.author;
            return validator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid,
          "and an error concerning the 'required' attribute": assertHasError('required'),
          "and the error message defined":                    assertHasErrorMsg('required', "is essential for survival")
        },
        "and if it has a missing non-required property": {
          topic: function (object, schema) {
            object = clone(object);
            delete object.category;
            return validator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertValid
        },
        "and if it has a incorrect pattern property": {
          topic: function (object, schema) {
            object = clone(object);
            object._additionalFlag = 'text';
            return validator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid
        },
        "and if it has a incorrect unique array property": {
          topic: function (object, schema) {
            object = clone(object);
            object.tags = ['a', 'a'];
            return validator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid
        },
        "and if it has a incorrect array property (wrong values)": {
          topic: function (object, schema) {
            object = clone(object);
            object.tags = ['a', '____'];
            return validator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid
        },
        "and if it has a incorrect array property (< minItems)": {
          topic: function (object, schema) {
            object = clone(object);
            object.tags = ['x'];
            return validator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid
        },
        "and if it has a incorrect format (date)": {
          topic: function (object, schema) {
            object = clone(object);
            object.date = 'bad date';
            return validator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid,
          "and the error message defined":                    assertHasErrorMsg('format', "must be a valid date and nothing else")
        },
        "and if it is not a palindrome (conform function)": {
          topic: function (object, schema) {
            object = clone(object);
            object.palindrome = 'bad palindrome';
            return validator.validate(object, schema);
          },
          "return an object with `valid` set to false":       assertInvalid
        },
        "and if it didn't validate a pattern": {
          topic: function (object, schema) {
            object = clone(object);
            object.author = 'email@address.com';
            return validator.validate(object, schema);
          },
          "return an object with `valid` set to false":      assertInvalid,
          "and an error concerning the 'pattern' attribute": assertHasError('pattern')
        },
      }
    },
    "with <cast> option": {
      topic: {
        properties: {
          answer: { type: "integer" },
          is_ready: { type: "boolean" }
        }
      },
      "and <integer> property": {
        "is castable string": {
          topic: function (schema) {
            return validator.validate({ answer: "42" }, schema, { cast: true });
          },
          "return an object with `valid` set to true": assertValid
        },
        "is uncastable string": {
          topic: function (schema) {
            return validator.validate({ answer: "forty2" }, schema, { cast: true });
          },
          "return an object with `valid` set to false": assertInvalid
        }
      },
      "and option <castSource>:true": {
        topic: function () {
          var schema = {
            properties: {
              answer: { type: "integer" },
              answer2: { type: "number" },
              answer3: {type: "array", items: {type: "string"}},
              answer4: {type: "array", items: {type: "integer"}},
              is_ready1: { type: "boolean" },
              is_ready2: { type: "boolean" },
              is_ready3: { type: "boolean" },
              is_ready4: { type: "boolean" },
              is_ready5: { type: "boolean" },
              is_ready6: { type: "boolean" }
            }
          };
          var source = {
            answer: "42",
            answer2: "42.2",
            answer3: ["yep"],
            answer4: [1, "2", 3, "4"],
            is_ready1: "true",
            is_ready2: "1",
            is_ready3: 1,
            is_ready4: "false",
            is_ready5: "0",
            is_ready6: 0
          };
          var options = { cast: true, castSource: true };
          return {
            res: validator.validate(source, schema, options),
            source: source
          };
        },
        "return an object with `valid` set to true": function(topic) {
          return assertValid(topic.res);
        },
        "and modified source object": {
          "with integer": function(topic) {
            return assert.strictEqual(topic.source.answer, 42);
          },
          "with float": function(topic) {
            return assert.strictEqual(topic.source.answer2, 42.2);
          },
          "with not affected array of strings": function(topic) {
            return assert.deepEqual(topic.source.answer3, ["yep"]);
          },
          "with casted items at array of integers": function(topic) {
            var actual = topic.source.answer4;
            if (!Array.isArray(actual)) assert.fail(actual, 'Not an array');
            //coz strict version of deepEqual doesn't exists
            var expected = [1, 2, 3, 4];
            topic.source.answer4.forEach(function(num, index) {
              assert.strictEqual(num, expected[index]);
            });
          },
          "with boolean true from string 'true'": function(topic) {
            return assert.strictEqual(topic.source.is_ready1, true);
          },
          "with boolean true from string '1'": function(topic) {
            return assert.strictEqual(topic.source.is_ready2, true);
          },
          "with boolean true from number 1": function(topic) {
            return assert.strictEqual(topic.source.is_ready3, true);
          },
          "with boolean false from string 'false'": function(topic) {
            return assert.strictEqual(topic.source.is_ready4, false);
          },
          "with boolean false from string '0'": function(topic) {
            return assert.strictEqual(topic.source.is_ready5, false);
          },
          "with boolean false from number 0": function(topic) {
            return assert.strictEqual(topic.source.is_ready6, false);
          }
        }
      },
      "and <boolean> property": {
        "is castable 'true/false' string": {
          topic: function (schema) {
            return validator.validate({ is_ready: "true" }, schema, { cast: true });
          },
          "return an object with `valid` set to true": assertValid
        },
        "is castable '1/0' string": {
          topic: function (schema) {
            return validator.validate({ is_ready: "1" }, schema, { cast: true });
          },
          "return an object with `valid` set to true": assertValid
        },
        "is castable `1/0` integer": {
          topic: function (schema) {
            return validator.validate({ is_ready: 1 }, schema, { cast: true });
          },
          "return an object with `valid` set to true": assertValid
        },
        "is uncastable string": {
          topic: function (schema) {
            return validator.validate({ is_ready: "not yet" }, schema, { cast: true });
          },
          "return an object with `valid` set to false": assertInvalid
        },
        "is uncastable number": {
          topic: function (schema) {
            return validator.validate({ is_ready: 42 }, schema, { cast: true });
          },
          "return an object with `valid` set to false": assertInvalid
        }
      },
      "default true": {
        topic: function(schema) {
          validator.validate.defaults.cast = true;
          return schema;
        },
        "and no direct <cast> option passed to validate": {
          "and castable number": {
            topic: function (schema) {
              return validator.validate({ answer: "42" }, schema);
            },
            "return an object with `valid` set to true": assertValid
          }
        },
        "and direct <cast> false passed to validate": {
          "and castable number": {
            topic: function (schema) {
              return validator.validate({ answer: "42" }, schema, { cast: false });
            },
            "return an object with `valid` set to false": assertInvalid
          }
        }
      }
    },
    "with <applyDefaultValue> option": {
      topic: {
        properties: {
          town: {
            type: "string"
          },
          country: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" }
            },
            "default": {
              id: 1,
              name: "New Zealand"
            }
          },
          planet: {
            "type": "string",
            "default": "Earth"
          }
        }
      },
      "enabled": {
        "and acting": {
          topic: function (schema) {
            var source = { town: "Auckland" };
            return {
              res: validator.validate(source, schema, {applyDefaultValue: true}),
              source: source
            }
          },
          "return an object with `valid` set to true": function(topic) {
            return assertValid(topic.res);
          },
          "and source object with default country and planet": function(topic) {
            assert.strictEqual(topic.source.town, "Auckland");
            assert.deepEqual(topic.source.country, {
              id: 1, name: "New Zealand"
            });
            assert.strictEqual(topic.source.planet, "Earth");
          }
        },
        "but not acting (since values in source object is set)": {
          topic: function (schema) {
            var source = {
              town: "New York",
              country: {
                id: 2,
                name: "USA"
              },
              planet: "Mars"
            };
            return {
              res: validator.validate(source, schema, {applyDefaultValue: true}),
              source: source
            }
          },
          "return an object with `valid` set to true": function(topic) {
            return assertValid(topic.res);
          },
          "and not modified source object": function(topic) {
            assert.strictEqual(topic.source.town, "New York");
            assert.deepEqual(topic.source.country, {id: 2, name: "USA"});
            assert.strictEqual(topic.source.planet, "Mars");
          }
        }
      },
      "not enabled": {
          topic: function (schema) {
            var source = { town: "Auckland" };
            return { res: validator.validate(source, schema), source: source }
          },
          "return an object with `valid` set to true": function(topic) {
            return assertValid(topic.res);
          },
          "and source object with undefined country and planet": function(topic) {
            assert.strictEqual(topic.source.town, "Auckland");
            assert.strictEqual(topic.source.country, undefined);
            assert.strictEqual(topic.source.planet, undefined);
          }
      }
    },
    "with <validateDefaultValue> option": {
      topic: {
        properties: {
          town: {
            type: "string"
          },
          country: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" }
            }
          },
          planet: {
            "type": "string"
          }
        }
      },
      "enabled": {
        "and valid default value": {
          topic: function(schema) {
            schema.properties.country['default'] = { id: 1, name: "New Zealand" };
            return validator.validate(
              { town: "Auckland" }, schema, { validateDefaultValue: true }
            );
          },
          "return an object with `valid` set to true": assertValid
        },
        "and invalid default value": {
          topic: function(schema) {
            schema.properties.country['default'] = { id: "abc", name: "New Zealand" };
            return validator.validate(
              { town: "Auckland" }, schema, { validateDefaultValue: true }
            );
          },
          "return an object with `valid` set to false": assertInvalid,
          "and an error concerning the attribute": assertHasError('type', 'id')
        }
      },
      "not enabled": {
        "and invalid default value": {
          topic: function(schema) {
            schema.properties.country['default'] = { id: "abc", name: "New Zealand" };
            return validator.validate({ town: "Auckland" }, schema);
          },
          "return an object with `valid` set to true": assertValid
        }
      }
    },
    "with break on first error options and source object with 2 errors": {
      topic: {
        schema: {
          properties: {
            town: {
              type: "string"
            },
            country: {
              type: "object",
              properties: {
                id: { type: "integer" },
                name: { type: "string" }
              },
              "default": {
                id: 1,
                name: "New Zealand"
              }
            },
            planet: {
              "type": "string",
              "default": "Earth"
            }
          }
        },
        source: {town: 1, planet: 2}
      },
      "when <exitOnFirstError> option enabled": {
        topic: function (topic) {
          return validator.validate(topic.source, topic.schema, {exitOnFirstError: true});
        },
        "return an object with `valid` set to false": assertInvalid,
        "1 error at errors": function(topic) {
          assert.strictEqual(topic.errors.length, 1);
        }
      },
      "when <exitOnFirstError> option not enabled": {
          topic: function (topic) {
            return validator.validate(topic.source, topic.schema);
          },
          "return an object with `valid` set to false": assertInvalid,
          "2 errors at errors": function(topic) {
            assert.strictEqual(topic.errors.length, 2);
          }
      },
      "when <failOnFirstError> option enabled": {
        topic: function (topic) {
          assert.throws(function() {
            validator.validate(topic.source, topic.schema, {failOnFirstError: true});
          }, function(err) {
              assert.strictEqual(err.message, 'Attribute `type` of property `town` hasn`t ' +
              'pass check, expected value: `string` actual value: `number` ' +
              'error message: `must be of string type`');
              assert.ok(err.info);
              return err instanceof Error;
          });
          return true;
        },
        "should throws an error and return true": function(topic) {
          assert.strictEqual(topic, true);
        }
      }
    },
    "filtering": {
      topic: function() {
        validator.validate.filters.trim = function(value) {
          return value.replace(/^\s+|\s+$/g, '');
        };
        validator.validate.filters.stripTags = function(value) {
          return value.replace(/<(?:.|\n)*?>/gm, '');
        };
        return {
            properties: {
              town: {
                type: ["string", "null", "array"],
                minLength: 3,
                filter: "trim"
              },
              country: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  name: { type: "string", filter: "stripTags" }
                }
              },
              planet: {
                type: ["string", "integer", "object"],
                filter: ["stripTags", validator.validate.filters.trim]
              }
            }
        };
      },
      "with valid values": {
        "and should be ok": {
          topic: function(schema) {
            var getSource = function() {
              return {
                town: "  Auckland  ",
                country: {
                  id: 1,
                  name: "<b>New Zealand</b>"
                },
                planet: "  <b>Earth</b>  "
              };
            };
            var source = getSource();
            return {
              res: validator.validate(source, schema),
              source: source,
              originalSource: getSource()
            };
          },
          "return an object with `valid` set to true": function(topic) {
            assertValid(topic.res);
          },
          "and modified source object": function(topic) {
            assert.strictEqual(
              topic.source.town,
              validator.validate.filters.trim(topic.originalSource.town)
            );
            assert.strictEqual(
              topic.source.country.name,
              validator.validate.filters.stripTags(topic.originalSource.country.name)
            );
            assert.strictEqual(
              topic.source.planet,
              validator.validate.filters.stripTags(
                validator.validate.filters.trim(topic.originalSource.planet)
              )
            );
          }
        },
        "but min length prevents filtering of 'town' field": {
          topic: function(schema) {
            var getSource = function() {
              return {
                town: " N",
                country: {
                  id: 1,
                  name: "<b>New Zealand</b>"
                },
                planet: "  <b>Earth</b>  "
              };
            };
            var source = getSource();
            return {
              res: validator.validate(source, schema),
              source: source,
              originalSource: getSource()
            }
          },
          "return an object with `valid` set to false": function(topic) {
            assertInvalid(topic.res);
          },
          "and an error with 'minLength' attribute and 'town'": function(topic) {
            assertHasError('minLength', 'town')(topic.res);
          },
          "and not modified 'town'": function(topic) {
            assert.strictEqual(topic.source.town, topic.originalSource.town);
          },
          "and modified 'planet'": function(topic) {
            assert.strictEqual(
              topic.source.planet,
              validator.validate.filters.stripTags(
                validator.validate.filters.trim(topic.originalSource.planet)
              )
            );
          }
        }
      },
      "with invalid values": {
        "(values break filter function)": {
          topic: function(schema) {
            return validator.validate({
                town: null,
                country: {
                  id: 1,
                  name: "<b>New Zealand</b>"
                },
                planet: 1
              }, schema);
          },
          "return an object with `valid` set to false": function(topic) {
            assertInvalid(topic);
          },
          "and an error with 'filter' attribute and 'town'": assertHasError('filter', 'town'),
          "and an error with 'filter' attribute and 'planet'": assertHasError('filter', 'planet')
        },
        "(values of unfilterable types)": {
          topic: function(schema) {
            return validator.validate({
                town: [1, 2],
                country: {
                  id: 1,
                  name: "<b>New Zealand</b>"
                },
                planet: {name: "Earth"}
              }, schema);
          },
          "return an object with `valid` set to false": function(topic) {
            assertInvalid(topic);
          },
          "and an error with 'filter' attribute and bad type messages": function(res) {
            assert.strictEqual(res.errors[0].attribute, 'filter');
            assert.strictEqual(res.errors[0].property, 'town');
            assert.strictEqual(res.errors[0].message, 'bad property type for filtering: array');
            assert.strictEqual(res.errors[1].attribute, 'filter');
            assert.strictEqual(res.errors[1].property, 'planet');
            assert.strictEqual(res.errors[1].message, 'bad property type for filtering: object');
          }
        }
      }
    }
  }
}).export(module);
