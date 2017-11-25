/* global vec2, vec3, vec4, mat2, mat2d, mat3, mat4, quat */
var WebGLGears = (function () {
  "use strict";
  var uploadBuffers, freeBuffers, loadShader, setupProgram, freeProgram;
  var defaultPrintCallback;
  var progSrc = {
    flat: {},
    smooth: {}
  };
  var __VertexBuilder;

  loadShader = function (gl, src, type, opt) {
    let shader, shaderInfo;
    let cb;

    opt = opt || {
      verbose: true
    };

    if (opt.cb) {
      cb = opt.cb;
    }
    else if (opt.cb === null) {
      cb = function () {};
    }
    else {
      cb = function (head, msg, e) {
        let f = e ? console.error : console.info;

        if (msg) {
          console.group(head);
          f(msg);
          console.groupEnd();
        }
        else {
          f(head);
        }
      };
    }

    shader = gl.createShader(type);
    if (!shader) {
      let e = new Error(gl, "Could not create shader.");

      Object.freeze(e);
      cb("Could not create shader.", null, e);
      throw e;
    }

    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const msg = [
        "Error compiling ",
        (function () {
          switch (type) {
          case gl.FRAGMENT_SHADER: return 'fragment';
          case gl.VERTEX_SHADER: return 'vertex';
          }
          return '?';
        })(),
        " shader",
        (function () {
          return opt.name ? (" '" + opt.name + "'.") : '.';
        })()
      ];
      let head = msg.join('');
      let e = new Error(gl, head);

      shaderInfo = gl.getShaderInfoLog(shader);
      e.infoLog = shaderInfo;
      Object.freeze(e);

      cb(head, shaderInfo, e);
      gl.deleteShader(shader);

      throw e;
    }
    if (opt.verbose) {
      shaderInfo = gl.getShaderInfoLog(shader);

      if (shaderInfo) {
        let head = "Log occurred compiling shader";

        if (opt.name) {
          head += " '" + opt.name + "': ";
        }
        else {
          head += ": ";
        }
        cb(head, shaderInfo);
      }
    }

    return shader;
  };
  setupProgram = function (gl, b) {
    let ret = {
      name: b.name,
      prog: gl.createProgram(),
      attrMap: b.attrMap,
      unif: {}
    };
    let i;
    let progInfoLog;
    let cb;

    if (b.errCB) {
      cb = b.errCB;
    }
    else {
      if (b.errCB === null) {
        cb = function () {};
      }
      else {
        cb = function (head, msg, e) {
          let f = e ? console.error : console.info;

          console.group(head);
          f(msg);
          console.groupEnd();
        };
      }
    }

    ret.vert = loadShader(gl, b.vert, gl.VERTEX_SHADER, {
      name: b.name,
      verbose: b.verbose});
    ret.frag = loadShader(gl, b.frag, gl.FRAGMENT_SHADER, {
      name: b.name,
      verbose: b.verbose});
    gl.attachShader(ret.prog, ret.vert);
    gl.attachShader(ret.prog, ret.frag);

    for (i in b.attrMap) {
      gl.bindAttribLocation(ret.prog, b.attrMap[i], i);
    }

    gl.linkProgram(ret.prog);

    if (gl.getProgramParameter(ret.prog, gl.LINK_STATUS)) {
      if (b.verbose) {
        progInfoLog = gl.getProgramInfoLog(ret.prog);
        if (progInfoLog) {
          let head = "Log occurred linking shader";

          if (b.name) {
            head += " '" + b.name + "':";
          }
          else {
            head += " :";
          }
          cb(head, progInfoLog);
        }
      }
    }
    else {
      let e = new Error(gl, "Failed to link program");
      let head = "Error linking shader";

      if (b.name) {
        head += " '" + b.name + "':";
      }
      else {
        head += " :";
      }
      progInfoLog = gl.getProgramInfoLog(ret.prog);
      e.infoLog = progInfoLog;
      Object.freeze(e);

      cb(head, progInfoLog, e);
      gl.deleteProgram(ret.prog);
      gl.deleteShader(ret.vert);
      gl.deleteShader(ret.frag);
      throw e;
    }

    for (i of b.unif) {
      ret.unif[i] = gl.getUniformLocation(ret.prog, i);
    }

    return ret;
  };
  freeProgram = function (gl, prog) {
    gl.deleteProgram(prog.prog);
    gl.deleteShader(prog.vert);
    gl.deleteShader(prog.frag);
  };
  uploadBuffers = function (gl, arr, buf) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.vertex);
    gl.bufferData(gl.ARRAY_BUFFER, arr.vertex, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.normal);
    gl.bufferData(gl.ARRAY_BUFFER, arr.normal, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arr.index, gl.STATIC_DRAW);
  };
  freeBuffers = function (gl, buf) {
    var __f = function (o) {
      if (o) {
        gl.deleteBuffer(o);
      }
    };

    __f(buf.vertex);
    __f(buf.normal);
    __f(buf.index);
  };
  defaultPrintCallback = function (head, body, e) {
    let f = e ? console.error : console.info;

    if (body) {
      console.group(head);
      f(body);
      if (e) {
        f(e.stack);
      }
      console.groupEnd();
    }
    else {
      f(head);
      if (e) {
        f(e.stack);
      }
    }
  };
  __VertexBuilder = (function () {
    var __MODE__ = {
      NONE: 0,
      QUADS: 1,
      QUAD_STRIP: 2
    };

    Object.freeze(__MODE__);

    return class VertexBuilder {
      constructor () {
        var __arr = null;
        var __state = {
          mode: __MODE__.NONE,
          normal: new Float32Array(3),
          ptr: {
            index: null
          },
          idx: {
            vertex: null,
            index: null
          },
          tmp: {
            idx: null,
            vertex: null,
            normal: null,
            firstStrip: null
          }
        };

        var __default;

        __default = function (org, def) {
          return isFinite(org) ? org : def;
        };

        Object.defineProperties(this, {
          allocCalls: {
            value: function (alloc) {
              const ALLOC = {
                QUADS: Math.trunc(alloc.QUADS) || 0,
                QUAD_STRIP: Math.trunc(alloc.QUAD_STRIP) || 0
              };
              const NB_VERTEX = 3 * (ALLOC.QUADS + ALLOC.QUAD_STRIP);
              const NB_INDEX = Math.trunc(ALLOC.QUADS / 4) * 6 + Math.max(Math.trunc(ALLOC.QUAD_STRIP / 2 - 1), 0) * 6;

              __arr = {
                vertex: new Float32Array(NB_VERTEX),
                normal: new Float32Array(NB_VERTEX),
                index: new Uint16Array(NB_INDEX)
              };
              __state.idx.vertex = __state.idx.index = __state.ptr.index = 0;

              return this;
            },
            configurable: true
          },
          begin: {
            value: function (mode) {
              switch(mode) {
              case __MODE__.QUADS:
                __state.mode = __MODE__.QUADS;
                __state.tmp.vertex = new Float32Array(3 * 4);
                __state.tmp.normal = new Float32Array(3 * 4);
                __state.tmp.idx = 0;
                break;
              case __MODE__.QUAD_STRIP:
                __state.mode = __MODE__.QUAD_STRIP;
                __state.tmp.vertex = new Float32Array(3 * 4);
                __state.tmp.normal = new Float32Array(3 * 4);
                __state.tmp.firstStrip = true;
                __state.tmp.idx = 0;
                break;
              default:
                throw Object.freeze(new TypeError("unknown value of 'mode': " + mode));
              }

              return this;
            },
            configurable: true
          },
          end: {
            value: function () {
              __state.mode = __state.tmp.vertex = __state.tmp.normal = __state.tmp.idx = __state.tmp.firstStrip = null;
              return this;
            },
            configurable: true
          },
          vertex: {
            value: function (x, y, z, w) {
              z = __default(z, 0);
              w = __default(w, 1);
              x /= w;
              y /= w;
              z /= w;

              __state.tmp.vertex[__state.tmp.idx + 0] = x;
              __state.tmp.vertex[__state.tmp.idx + 1] = y;
              __state.tmp.vertex[__state.tmp.idx + 2] = z;
              __state.tmp.normal[__state.tmp.idx + 0] = __state.normal[0];
              __state.tmp.normal[__state.tmp.idx + 1] = __state.normal[1];
              __state.tmp.normal[__state.tmp.idx + 2] = __state.normal[2];

              switch (__state.mode) {
              case __MODE__.QUADS:
                if (__state.tmp.idx >= 9) {
                  __arr.vertex[__state.idx.vertex + 0] = __state.tmp.vertex[0];
                  __arr.vertex[__state.idx.vertex + 1] = __state.tmp.vertex[1];
                  __arr.vertex[__state.idx.vertex + 2] = __state.tmp.vertex[2];
                  __arr.vertex[__state.idx.vertex + 3] = __state.tmp.vertex[3];
                  __arr.vertex[__state.idx.vertex + 4] = __state.tmp.vertex[4];
                  __arr.vertex[__state.idx.vertex + 5] = __state.tmp.vertex[5];
                  __arr.vertex[__state.idx.vertex + 6] = __state.tmp.vertex[6];
                  __arr.vertex[__state.idx.vertex + 7] = __state.tmp.vertex[7];
                  __arr.vertex[__state.idx.vertex + 8] = __state.tmp.vertex[8];
                  __arr.vertex[__state.idx.vertex + 9] = __state.tmp.vertex[9];
                  __arr.vertex[__state.idx.vertex + 10] = __state.tmp.vertex[10];
                  __arr.vertex[__state.idx.vertex + 11] = __state.tmp.vertex[11];

                  __arr.normal[__state.idx.vertex + 0] = __state.tmp.vertex[0] + __state.tmp.normal[0];
                  __arr.normal[__state.idx.vertex + 1] = __state.tmp.vertex[1] + __state.tmp.normal[1];
                  __arr.normal[__state.idx.vertex + 2] = __state.tmp.vertex[2] + __state.tmp.normal[2];
                  __arr.normal[__state.idx.vertex + 3] = __state.tmp.vertex[3] + __state.tmp.normal[3];
                  __arr.normal[__state.idx.vertex + 4] = __state.tmp.vertex[4] + __state.tmp.normal[4];
                  __arr.normal[__state.idx.vertex + 5] = __state.tmp.vertex[5] + __state.tmp.normal[5];
                  __arr.normal[__state.idx.vertex + 6] = __state.tmp.vertex[6] + __state.tmp.normal[6];
                  __arr.normal[__state.idx.vertex + 7] = __state.tmp.vertex[7] + __state.tmp.normal[7];
                  __arr.normal[__state.idx.vertex + 8] = __state.tmp.vertex[8] + __state.tmp.normal[8];
                  __arr.normal[__state.idx.vertex + 9] = __state.tmp.vertex[9] + __state.tmp.normal[9];
                  __arr.normal[__state.idx.vertex + 10] =  __state.tmp.vertex[10] + __state.tmp.normal[10];
                  __arr.normal[__state.idx.vertex + 11] =  __state.tmp.vertex[11] + __state.tmp.normal[11];

                  __arr.index[__state.idx.index + 0] = __state.ptr.index + 3;
                  __arr.index[__state.idx.index + 1] = __state.ptr.index + 0;
                  __arr.index[__state.idx.index + 2] = __state.ptr.index + 1;
                  __arr.index[__state.idx.index + 3] = __state.ptr.index + 1;
                  __arr.index[__state.idx.index + 4] = __state.ptr.index + 2;
                  __arr.index[__state.idx.index + 5] = __state.ptr.index + 3;

                  __state.idx.vertex += 12;
                  __state.idx.index += 6;
                  __state.ptr.index += 4;
                  __state.tmp.idx = 0;
                }
                else {
                  __state.tmp.idx += 3;
                }

                break;
              case __MODE__.QUAD_STRIP:
                if (__state.tmp.firstStrip) {
                  if (__state.tmp.idx >= 9) {
                    __arr.vertex[__state.idx.vertex + 0] = __state.tmp.vertex[0];
                    __arr.vertex[__state.idx.vertex + 1] = __state.tmp.vertex[1];
                    __arr.vertex[__state.idx.vertex + 2] = __state.tmp.vertex[2];
                    __arr.vertex[__state.idx.vertex + 3] = __state.tmp.vertex[3];
                    __arr.vertex[__state.idx.vertex + 4] = __state.tmp.vertex[4];
                    __arr.vertex[__state.idx.vertex + 5] = __state.tmp.vertex[5];
                    __arr.vertex[__state.idx.vertex + 6] = __state.tmp.vertex[6];
                    __arr.vertex[__state.idx.vertex + 7] = __state.tmp.vertex[7];
                    __arr.vertex[__state.idx.vertex + 8] = __state.tmp.vertex[8];
                    __arr.vertex[__state.idx.vertex + 9] = __state.tmp.vertex[9];
                    __arr.vertex[__state.idx.vertex + 10] = __state.tmp.vertex[10];
                    __arr.vertex[__state.idx.vertex + 11] = __state.tmp.vertex[11];

                    __arr.normal[__state.idx.vertex + 0] = __state.tmp.vertex[0] + __state.tmp.normal[0];
                    __arr.normal[__state.idx.vertex + 1] = __state.tmp.vertex[1] + __state.tmp.normal[1];
                    __arr.normal[__state.idx.vertex + 2] = __state.tmp.vertex[2] + __state.tmp.normal[2];
                    __arr.normal[__state.idx.vertex + 3] = __state.tmp.vertex[3] + __state.tmp.normal[3];
                    __arr.normal[__state.idx.vertex + 4] = __state.tmp.vertex[4] + __state.tmp.normal[4];
                    __arr.normal[__state.idx.vertex + 5] = __state.tmp.vertex[5] + __state.tmp.normal[5];
                    __arr.normal[__state.idx.vertex + 6] = __state.tmp.vertex[6] + __state.tmp.normal[6];
                    __arr.normal[__state.idx.vertex + 7] = __state.tmp.vertex[7] + __state.tmp.normal[7];
                    __arr.normal[__state.idx.vertex + 8] = __state.tmp.vertex[8] + __state.tmp.normal[8];
                    __arr.normal[__state.idx.vertex + 9] = __state.tmp.vertex[9] + __state.tmp.normal[9];
                    __arr.normal[__state.idx.vertex + 10] =  __state.tmp.vertex[10] + __state.tmp.normal[10];
                    __arr.normal[__state.idx.vertex + 11] =  __state.tmp.vertex[11] + __state.tmp.normal[11];

                    __arr.index[__state.idx.index + 0] = __state.ptr.index + 0;
                    __arr.index[__state.idx.index + 1] = __state.ptr.index + 1;
                    __arr.index[__state.idx.index + 2] = __state.ptr.index + 3;
                    __arr.index[__state.idx.index + 3] = __state.ptr.index + 0;
                    __arr.index[__state.idx.index + 4] = __state.ptr.index + 3;
                    __arr.index[__state.idx.index + 5] = __state.ptr.index + 2;

                    __state.idx.vertex += 12;
                    __state.idx.index += 6;
                    __state.ptr.index += 4;
                    __state.tmp.idx = 0;
                    __state.tmp.firstStrip = false;
                  }
                  else {
                    __state.tmp.idx += 3;
                  }
                }
                else {
                  if (__state.tmp.idx >= 3) {
                    __arr.vertex[__state.idx.vertex + 0] = __state.tmp.vertex[0];
                    __arr.vertex[__state.idx.vertex + 1] = __state.tmp.vertex[1];
                    __arr.vertex[__state.idx.vertex + 2] = __state.tmp.vertex[2];
                    __arr.vertex[__state.idx.vertex + 3] = __state.tmp.vertex[3];
                    __arr.vertex[__state.idx.vertex + 4] = __state.tmp.vertex[4];
                    __arr.vertex[__state.idx.vertex + 5] = __state.tmp.vertex[5];

                    __arr.normal[__state.idx.vertex + 0] = __state.tmp.vertex[0] + __state.tmp.normal[0];
                    __arr.normal[__state.idx.vertex + 1] = __state.tmp.vertex[1] + __state.tmp.normal[1];
                    __arr.normal[__state.idx.vertex + 2] = __state.tmp.vertex[2] + __state.tmp.normal[2];
                    __arr.normal[__state.idx.vertex + 3] = __state.tmp.vertex[3] + __state.tmp.normal[3];
                    __arr.normal[__state.idx.vertex + 4] = __state.tmp.vertex[4] + __state.tmp.normal[4];
                    __arr.normal[__state.idx.vertex + 5] = __state.tmp.vertex[5] + __state.tmp.normal[5];

                    __arr.index[__state.idx.index + 0] = __state.ptr.index + 0 - 2;
                    __arr.index[__state.idx.index + 1] = __state.ptr.index + 1 - 2;
                    __arr.index[__state.idx.index + 2] = __state.ptr.index + 3 - 2;
                    __arr.index[__state.idx.index + 3] = __state.ptr.index + 0 - 2;
                    __arr.index[__state.idx.index + 4] = __state.ptr.index + 3 - 2;
                    __arr.index[__state.idx.index + 5] = __state.ptr.index + 2 - 2;

                    __state.idx.vertex += 6;
                    __state.idx.index += 6;
                    __state.ptr.index += 2;
                    __state.tmp.idx = 0;
                  }
                  else {
                    __state.tmp.idx += 3;
                  }
                }

                break;
              }

              return this;
            },
            configurable: true
          },
          normal: {
            value: function (x, y, z) {
              __state.normal[0] = x;
              __state.normal[1] = y;
              __state.normal[2] = z;

              return this;
            },
            configurable: true
          },
          array: {
            get: function () {
              return __arr;
            },
            configurable: true
          }
        });
      }

      static get MODE () {
        return __MODE__;
      }
    };
  })();

  progSrc.flat.vert = "uniform mat4 u_tf;\r\nuniform mat4 u_view;\r\nuniform mat4 u_mv;\r\nuniform mat3 u_nm;\r\n\r\nuniform vec3 u_lightDir_us;\r\nuniform vec3 u_ambient;\r\nuniform vec3 u_diffuse;\r\nuniform vec3 u_ambientIntensity;\r\n\r\nattribute vec3 a_pos;\r\nattribute vec3 a_normal;\r\n\r\nvarying vec3 v_fragColor;\r\n\r\n\r\nvoid main () {\r\n  vec4 pos_ms = vec4(a_pos, 1.0);\r\n  vec3 pos_cs = (u_mv * pos_ms).xyz;\r\n  vec3 normal_cs = (u_mv * vec4(a_normal, 1.0)).xyz;\r\n\r\n  float theta = max(dot(-u_lightDir_us, normalize((pos_cs - normal_cs).xyz)), 0.0);\r\n\r\n  v_fragColor = u_ambientIntensity * u_ambient + u_diffuse * theta;\r\n  gl_Position = u_tf * pos_ms;\r\n}\r\n";
  progSrc.flat.frag = "precision mediump float;\r\n\r\nvarying vec3 v_fragColor;\r\n\r\n\r\nvoid main () {\r\n  gl_FragColor = vec4(v_fragColor, 1.0);\r\n}\r\n";
  progSrc.smooth.vert = "uniform mat4 u_tf;\r\nuniform mat4 u_view;\r\nuniform mat4 u_mv;\r\nuniform mat3 u_nm;\r\n\r\nattribute vec3 a_pos;\r\nattribute vec3 a_normal;\r\n\r\nvarying vec3 v_normal_cs;\r\nvarying vec3 v_pos_cs;\r\n\r\n\r\nvoid main () {\r\n  vec4 pos_ms = vec4(a_pos, 1.0);\r\n\r\n  v_pos_cs = (u_mv * pos_ms).xyz;\r\n  v_normal_cs = (u_mv * vec4(a_normal, 1.0)).xyz;\r\n  gl_Position = u_tf * pos_ms;\r\n}\r\n";
  progSrc.smooth.frag = "precision mediump float;\r\n\r\nuniform vec3 u_lightDir_us;\r\nuniform vec3 u_ambient;\r\nuniform vec3 u_diffuse;\r\nuniform vec3 u_ambientIntensity;\r\n\r\nvarying vec3 v_normal_cs;\r\nvarying vec3 v_pos_cs;\r\n\r\n\r\nvoid main () {\r\n  float theta = max(dot(-u_lightDir_us, normalize(v_pos_cs - v_normal_cs)), 0.0);\r\n  gl_FragColor = vec4(u_ambientIntensity * u_ambient + u_diffuse * theta, 1.0);\r\n}\r\n";

  return class WebGLGears {
    constructor () {
      var __view_rotx = 20.0;
      var __view_roty = 30.0;
      var __view_rotz = 0.0;
      var __angle = 0.0;
      var __animate = true;
      var __frames = 0, __tRot0 = null, __tRate0 = null;

      var __init, __gear, __draw_gears, __draw_frame, __draw;
      var __updateViewMatrix;
      var __gl = null, __w = null;
      var __arrGears = [];
      var __prog = {};
      var __printCallback = defaultPrintCallback;
      var __verbose = false;

      var __mat = {
        view: mat4.create(),
        projection: mat4.create()
      };
      var __light = {
        pos: {
          ws: vec4.fromValues(5.0, 5.0, 10.0, 1.0),
          us: vec3.create()
        }
      };
      var __tmp = {
        modelInv: mat4.create(),
        view: {
          rotate: {
            x: mat4.create(),
            y: mat4.create(),
            z: mat4.create()
          },
          translate: mat4.create()
        }
      };
      var __viewport = {
        w: 0,
        h: 0
      };
      var __eyePos = vec3.fromValues(0.0, 0.0, -40.0);

      mat4.identity(__mat.projection);

      __init = function () {
        let m;

        // Reset state members
        __frames = 0;
        __tRate0 = __tRot0 = null;
        __prog = {};
        __arrGears = [];
        __angle = 0.0;

        __prog.flat = setupProgram(__gl, {
          vert: progSrc.flat.vert,
          frag: progSrc.flat.frag,
          attrMap: {
            0: 'a_pos',
            1: 'a_normal'
          },
          unif: [
            'u_tf',
            'u_view',
            'u_mv',
            'u_nm',
            'u_lightDir_us',
            'u_ambient',
            'u_diffuse',
            'u_ambientIntensity'
          ]
        });
        __prog.smooth = setupProgram(__gl, {
          vert: progSrc.smooth.vert,
          frag: progSrc.smooth.frag,
          attrMap: {
            0: 'a_pos',
            1: 'a_normal'
          },
          unif: [
            'u_tf',
            'u_view',
            'u_mv',
            'u_nm',
            'u_lightDir_us',
            'u_ambient',
            'u_diffuse',
            'u_ambientIntensity'
          ]
        });

        __gl.useProgram(__prog.flat.prog);
        __gl.uniform3fv(__prog.flat.unif['u_ambientIntensity'], [0.2, 0.2, 0.2]);
        __gl.useProgram(__prog.smooth.prog);
        __gl.uniform3fv(__prog.smooth.unif['u_ambientIntensity'], [0.2, 0.2, 0.2]);

        m = __gear(1.0, 4.0, 1.0, 20, 0.7);
        m.material = [ 0.8, 0.1, 0.0 ];
        __arrGears.push(m);

        m = __gear(0.5, 2.0, 2.0, 10, 0.7);
        m.material = [ 0.0, 0.8, 0.2 ];
        __arrGears.push(m);

        m = __gear(1.3, 2.0, 0.5, 10, 0.7);
        m.material = [ 0.2, 0.2, 1.0 ];
        __arrGears.push(m);

        for (m of __arrGears) {
          m.vec = {
            translate: vec3.create(),
            lightPos_cs: vec3.create()
          };
          m.mat = {
            rotate:  mat4.create(),
            translate:  mat4.create(),
            model: mat4.create(),
            mv: mat4.create(),
            nm: mat3.create(),
            tf: mat4.create()
          };
        }
      };
      // Upload a gear wheel model.
      // A wheel consists of two render parts: the flat and smooth shading part
      // which need be rendered using two different programs.
      // Input:  inner_radius - radius of hole at center
      //         outer_radius - radius at center of teeth
      //         width - width of gear
      //         teeth - number of teeth
      //         tooth_depth - depth of tooth
      // Return: (An object containing following properties)
      //         flat.arr.vertex - Float32Array of vertices
      //         flat.arr.normal - Float32Array of normal vectors (model space)
      //         flat.arr.index - Uint16Array of indices
      //         flat.buf.vertex - ARRAY_BUFFER
      //         flat.buf.normal - ARRAY_BUFFER
      //         flat.buf.index - ELEMENT_ARRAY_BUFFER
      //         smooth.arr.vertex
      //         smooth.arr.normal
      //         smooth.arr.index
      //         smooth.buf.vertex
      //         smooth.buf.normal
      //         smooth.buf.index
      __gear = function (inner_radius, outer_radius, width, teeth, tooth_depth) {
        let vb = {
          flat: (new __VertexBuilder()).allocCalls({
            QUADS: (teeth * 4) * 2,
            QUAD_STRIP: (4 * teeth + 2) * 2 + (8 * teeth + 2)
          }),
          smooth: (new __VertexBuilder()).allocCalls({
            QUADS: 0,
            QUAD_STRIP: (teeth + 1) * 2
          })
        };
        let ret = {
          flat: {
            arr: vb.flat.array,
            buf: {
              vertex: __gl.createBuffer(),
              normal: __gl.createBuffer(),
              index: __gl.createBuffer()
            }
          },
          smooth: {
            arr: vb.smooth.array,
            buf: {
              vertex: __gl.createBuffer(),
              normal: __gl.createBuffer(),
              index: __gl.createBuffer()
            }
          }
        };
        let i;
        let r0, r1, r2;
        let angle, da;
        let u, v, len;

        r0 = inner_radius;
        r1 = outer_radius - tooth_depth / 2.0;
        r2 = outer_radius + tooth_depth / 2.0;

        // draw front face
        da = 2.0 * Math.PI / teeth / 4.0;
        vb.flat
          .begin(__VertexBuilder.MODE.QUAD_STRIP)
          .normal(0.0, 0.0, 1.0);
        for (i = 0; i <= teeth; i += 1) {
          angle = i * 2.0 * Math.PI / teeth;
          vb.flat
            .vertex(r0 * Math.cos(angle), r0 * Math.sin(angle), width * 0.5)
            .vertex(r1 * Math.cos(angle), r1 * Math.sin(angle), width * 0.5);
          if (i < teeth) {
            vb.flat
              .vertex(r0 * Math.cos(angle), r0 * Math.sin(angle), width * 0.5)
              .vertex(r1 * Math.cos(angle + 3 * da), r1 * Math.sin(angle + 3 * da), width * 0.5);
          }
        }
        vb.flat.end();

        // draw front sides of teeth
        da = 2.0 * Math.PI / teeth / 4.0;
        vb.flat.begin(__VertexBuilder.MODE.QUADS);
        for (i = 0; i < teeth; i += 1) {
          angle = i * 2.0 * Math.PI / teeth;
          vb.flat
            .vertex(r1 * Math.cos(angle), r1 * Math.sin(angle), width * 0.5)
            .vertex(r2 * Math.cos(angle + da), r2 * Math.sin(angle + da), width * 0.5)
            .vertex(r2 * Math.cos(angle + 2 * da), r2 * Math.sin(angle + 2 * da), width * 0.5)
            .vertex(r1 * Math.cos(angle + 3 * da), r1 * Math.sin(angle + 3 * da), width * 0.5);
        }
        vb.flat.end();

        // draw back face
        vb.flat
          .begin(__VertexBuilder.MODE.QUAD_STRIP)
          .normal(0.0, 0.0, -1.0);
        for (i = 0; i <= teeth; i += 1) {
          angle = i * 2.0 * Math.PI / teeth;
          vb.flat
            .vertex(r1 * Math.cos(angle), r1 * Math.sin(angle), -width * 0.5)
            .vertex(r0 * Math.cos(angle), r0 * Math.sin(angle), -width * 0.5);
          if (i < teeth) {
            vb.flat
              .vertex(r1 * Math.cos(angle + 3 * da), r1 * Math.sin(angle + 3 * da), -width * 0.5)
              .vertex(r0 * Math.cos(angle), r0 * Math.sin(angle), -width * 0.5);
          }
        }
        vb.flat.end();

        // draw back sides of teeth
        da = 2.0 * Math.PI / teeth / 4.0;
        vb.flat.begin(__VertexBuilder.MODE.QUADS);
        for (i = 0; i < teeth; i += 1) {
          angle = i * 2.0 * Math.PI / teeth;
          vb.flat
            .vertex(r1 * Math.cos(angle + 3 * da), r1 * Math.sin(angle + 3 * da), -width * 0.5)
            .vertex(r2 * Math.cos(angle + 2 * da), r2 * Math.sin(angle + 2 * da), -width * 0.5)
            .vertex(r2 * Math.cos(angle + da), r2 * Math.sin(angle + da), -width * 0.5)
            .vertex(r1 * Math.cos(angle), r1 * Math.sin(angle), -width * 0.5);
        }
        vb.flat.end();

        // draw outward faces of teeth
        vb.flat.begin(__VertexBuilder.MODE.QUAD_STRIP);
        for (i = 0; i < teeth; i += 1) {
          angle = i * 2.0 * Math.PI / teeth;
          vb.flat
            .vertex(r1 * Math.cos(angle), r1 * Math.sin(angle), width * 0.5)
            .vertex(r1 * Math.cos(angle), r1 * Math.sin(angle), -width * 0.5);
          u = r2 * Math.cos(angle + da) - r1 * Math.cos(angle);
          v = r2 * Math.sin(angle + da) - r1 * Math.sin(angle);
          len = Math.sqrt(u * u + v * v);
          u /= len;
          v /= len;
          vb.flat
            .normal(v, -u, 0.0)
            .vertex(r2 * Math.cos(angle + da), r2 * Math.sin(angle + da), width * 0.5)
            .vertex(r2 * Math.cos(angle + da), r2 * Math.sin(angle + da), -width * 0.5);
          vb.flat
            .normal(Math.cos(angle), Math.sin(angle), 0.0)
            .vertex(r2 * Math.cos(angle + 2 * da), r2 * Math.sin(angle + 2 * da), width * 0.5)
            .vertex(r2 * Math.cos(angle + 2 * da), r2 * Math.sin(angle + 2 * da), -width * 0.5);
          u = r1 * Math.cos(angle + 3 * da) - r2 * Math.cos(angle + 2 * da);
          v = r1 * Math.sin(angle + 3 * da) - r2 * Math.sin(angle + 2 * da);
          vb.flat
            .normal(v, -u, 0.0)
            .vertex(r1 * Math.cos(angle + 3 * da), r1 * Math.sin(angle + 3 * da), width * 0.5)
            .vertex(r1 * Math.cos(angle + 3 * da), r1 * Math.sin(angle + 3 * da), -width * 0.5)
            .normal(Math.cos(angle), Math.sin(angle), 0.0);
        }
        vb.flat
          .vertex(r1 * Math.cos(0), r1 * Math.sin(0), width * 0.5)
          .vertex(r1 * Math.cos(0), r1 * Math.sin(0), -width * 0.5)
          .end();

        // draw inside radius cylinder
        vb.smooth.begin(__VertexBuilder.MODE.QUAD_STRIP);
        for (i = 0; i <= teeth; i += 1) {
          angle = i * 2.0 * Math.PI / teeth;
          vb.smooth
            .normal(-Math.cos(angle), -Math.sin(angle), 0.0)
            .vertex(r0 * Math.cos(angle), r0 * Math.sin(angle), -width * 0.5)
            .vertex(r0 * Math.cos(angle), r0 * Math.sin(angle), width * 0.5);
        }
        vb.smooth.end();

        // Upload buffers
        uploadBuffers(__gl, ret.flat.arr, ret.flat.buf);
        uploadBuffers(__gl, ret.smooth.arr, ret.smooth.buf);

        return ret;
      };
      __draw_gears = function () {
        let g;

        // Host side calculation
        vec3.normalize(__light.pos.us, __light.pos.ws);

        vec3.copy(__arrGears[0].vec.translate, [-3.0, -2.0, 0.0]);
        mat4.fromRotation(__arrGears[0].mat.rotate, __angle * Math.PI / 180, [0.0, 0.0, 1.0]);

        vec3.copy(__arrGears[1].vec.translate, [3.1, -2.0, 0.0]);
        mat4.fromRotation(__arrGears[1].mat.rotate, (-2.0 * __angle - 9.0) * Math.PI / 180, [0.0, 0.0, 1.0]);

        vec3.copy(__arrGears[2].vec.translate, [-3.1, 4.2, 0.0]);
        mat4.fromRotation(__arrGears[2].mat.rotate, (-2.0 * __angle - 25.0) * Math.PI / 180, [0.0, 0.0, 1.0]);

        for (g of __arrGears) {
          mat4.fromTranslation(g.mat.translate, g.vec.translate);
          mat4.mul(g.mat.model, g.mat.translate, g.mat.rotate);
          mat4.invert(__tmp.modelInv, g.mat.model);
          g.mat.nm[0] = __tmp.modelInv[0];
          g.mat.nm[1] = __tmp.modelInv[4];
          g.mat.nm[2] = __tmp.modelInv[8];
          g.mat.nm[3] = __tmp.modelInv[1];
          g.mat.nm[4] = __tmp.modelInv[5];
          g.mat.nm[5] = __tmp.modelInv[9];
          g.mat.nm[6] = __tmp.modelInv[2];
          g.mat.nm[7] = __tmp.modelInv[6];
          g.mat.nm[8] = __tmp.modelInv[10];
          mat4.mul(g.mat.mv, __mat.view, g.mat.model);
          mat4.mul(g.mat.tf, __mat.projection, __mat.view);
          mat4.mul(g.mat.tf, g.mat.tf, g.mat.model);
        }

        // GL calls
        __gl.enable(__gl.CULL_FACE);
        __gl.enable(__gl.DEPTH_TEST);
        __gl.enableVertexAttribArray(0);
        __gl.enableVertexAttribArray(1);

        __gl.useProgram(__prog.flat.prog);
        __gl.uniform3fv(__prog.flat.unif['u_lightDir_us'], __light.pos.us);
        for (g of __arrGears) {
          __gl.uniformMatrix4fv(__prog.flat.unif['u_tf'], __gl.FALSE, g.mat.tf);
          __gl.uniformMatrix4fv(__prog.flat.unif['u_view'], __gl.FALSE, __mat.view);
          __gl.uniformMatrix4fv(__prog.flat.unif['u_mv'], __gl.FALSE, g.mat.mv);
          __gl.uniform3fv(__prog.flat.unif['u_ambient'], g.material);
          __gl.uniform3fv(__prog.flat.unif['u_diffuse'], g.material);

          __gl.bindBuffer(__gl.ARRAY_BUFFER, g.flat.buf.vertex);
          __gl.vertexAttribPointer(0, 3, __gl.FLOAT, __gl.FALSE, 0, 0);
          __gl.bindBuffer(__gl.ARRAY_BUFFER, g.flat.buf.normal);
          __gl.vertexAttribPointer(1, 3, __gl.FLOAT, __gl.FALSE, 0, 0);
          __gl.bindBuffer(__gl.ELEMENT_ARRAY_BUFFER, g.flat.buf.index);

          __gl.drawElements(__gl.TRIANGLES, g.flat.arr.index.length, __gl.UNSIGNED_SHORT, 0);
        }

        __gl.useProgram(__prog.smooth.prog);
        __gl.uniform3fv(__prog.smooth.unif['u_lightDir_us'], __light.pos.us);
        for (g of __arrGears) {
          __gl.uniformMatrix4fv(__prog.smooth.unif['u_tf'], __gl.FALSE, g.mat.tf);
          __gl.uniformMatrix4fv(__prog.smooth.unif['u_view'], __gl.FALSE, __mat.view);
          __gl.uniformMatrix4fv(__prog.smooth.unif['u_mv'], __gl.FALSE, g.mat.mv);
          __gl.uniform3fv(__prog.smooth.unif['u_ambient'], g.material);
          __gl.uniform3fv(__prog.smooth.unif['u_diffuse'], g.material);

          __gl.bindBuffer(__gl.ARRAY_BUFFER, g.smooth.buf.vertex);
          __gl.vertexAttribPointer(0, 3, __gl.FLOAT, __gl.FALSE, 0, 0);
          __gl.bindBuffer(__gl.ARRAY_BUFFER, g.smooth.buf.normal);
          __gl.vertexAttribPointer(1, 3, __gl.FLOAT, __gl.FALSE, 0, 0);
          __gl.bindBuffer(__gl.ELEMENT_ARRAY_BUFFER, g.smooth.buf.index);

          __gl.drawElements(__gl.TRIANGLES, g.smooth.arr.index.length, __gl.UNSIGNED_SHORT, 0);
        }

        __gl.useProgram(null);

        __gl.disable(__gl.CULL_FACE);
        __gl.disable(__gl.DEPTH_TEST);
        __gl.disableVertexAttribArray(1);
      };
      __draw_frame = function () {
        let dt;
        const t = performance.now() / 1000.0;

        if (__tRot0 === null) {
          __tRot0 = t;
        }
        dt = t - __tRot0;
        __tRot0 = t;

        if (__animate) {
          // advance rotation for next frame
          __angle += 70.0 * dt; // 70 degrees per second
          if (__angle > 3600.0) {
            __angle += 3600.0;
          }
        }

        __gl.viewport(0, 0, __viewport.w, __viewport.h);
        __gl.clear(__gl.COLOR_BUFFER_BIT | __gl.DEPTH_BUFFER_BIT);
        __draw_gears();
        __gl.flush();

        __frames += 1;

        if (__tRate0 === null) {
          __tRate0 = t;
        }
        if (t - __tRate0 >= 5.0) {
          if (__printCallback && __verbose) {
            const seconds = t - __tRate0;
            const fps = __frames / seconds;
            let msg = [
              "WebGL Gears: ",
              __frames,
              " frames in ",
              seconds.toFixed(1),
              " seconds = ",
              fps.toFixed(3),
              " FPS"
            ];

            __printCallback(msg.join(''));
          }
          __tRate0 = t;
          __frames = 0;
        }
      };
      __draw = function () {
        if (__gl && __w) {
          __draw_frame();
          __w.requestAnimationFrame(__draw);
        }
      };
      __updateViewMatrix = function () {
        mat4.fromRotation(__tmp.view.rotate.x, __view_rotx * Math.PI / 180, [1.0, 0.0, 0.0]);
        mat4.fromRotation(__tmp.view.rotate.y, __view_roty * Math.PI / 180, [0.0, 1.0, 0.0]);
        mat4.fromRotation(__tmp.view.rotate.z, __view_rotz * Math.PI / 180, [0.0, 0.0, 1.0]);
        mat4.fromTranslation(__tmp.view.translate, __eyePos);
        mat4.mul(__mat.view, __tmp.view.translate, __tmp.view.rotate.x);
        mat4.mul(__mat.view, __mat.view, __tmp.view.rotate.y);
        mat4.mul(__mat.view, __mat.view, __tmp.view.rotate.z);
      };

      Object.defineProperties(this, {
        attach: {
          value: function (w, gl) {
            this.detach();
            __gl = gl;
            __w = w;

            __init();
            __w.requestAnimationFrame(__draw);

            return this;
          },
          configurable: true
        },
        detach: {
          value: function () {
            let g;

            while (__arrGears.length > 0) {
              g = __arrGears.pop();
              freeBuffers(__gl, g.flat.buf);
              freeBuffers(__gl, g.smooth.buf);
            }

            if (__prog.flat) {
              freeProgram(__gl, __prog.flat);
            }
            if (__prog.smooth) {
              freeProgram(__gl, __prog.smooth);
            }

            __gl = null;
            __w = null;

            return this;
          },
          configurable: true
        },
        reshape: {
          value: function (width, height) {
            const h = height / width;

            __viewport.w = width;
            __viewport.h = height;
            mat4.frustum(__mat.projection, -1.0, 1.0, -h, h, 5.0, 60.0);

            return this;
          },
          configurable: true
        },
        view_rotx: {
          get: function () {
            return __view_rotx;
          },
          set: function (rotx) {
            __view_rotx = rotx;
            __updateViewMatrix();
            return this;
          },
          configurable: true
        },
        view_roty: {
          get: function () {
            return __view_roty;
          },
          set: function (roty) {
            __view_roty = roty;
            __updateViewMatrix();
            return this;
          },
          configurable: true
        },
        view_rotz: {
          get: function () {
            return __view_rotz;
          },
          set: function (rotz) {
            __view_rotz = rotz;
            __updateViewMatrix();
            return this;
          },
          configurable: true
        },
        animate: {
          get: function () {
            return __animate;
          },
          set: function (a) {
            __animate = a;
            return this;
          },
          configurable: true
        },
        verbose: {
          get: function () {
            return __verbose;
          },
          set: function (v) {
            __verbose = v;
            return this;
          },
          configurable: true
        },
        printCallback: {
          get: function () {
            return __printCallback;
          },
          set: function (cb) {
            if (cb === null) {
              __printCallback = defaultPrintCallback;
            }
            else {
              __printCallback = cb;
            }

            return this;
          },
          configurable: true
        },
        info: {
          value: function () {
            if (__gl) {
              let arr = [
                "GL_RENDERER   = " + __gl.getParameter(__gl.RENDERER),
                "GL_VERSION    = " + __gl.getParameter(__gl.VERSION),
                "GL_VENDOR     = " + __gl.getParameter(__gl.VENDOR),
                "GL_EXTENSIONS = " + __gl.getSupportedExtensions().join(' ')
              ];

              __printCallback("WebGL Gears Info", arr.join('\n'));
            }
            return this;
          },
          configurable: true
        }
      });

      __updateViewMatrix();
    }

    static get VertexBuilder () {
      return __VertexBuilder;
    }

    static optimalContextParams () {
      return {
        type: 'webgl',
        attr: {
          alpha: false,
          depth: true,
          stencil: false,
          antialias: false
        }
      };
    }
  };
})();
