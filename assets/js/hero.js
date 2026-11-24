/* R-717 Training — hero: WebGL frost / ammonia vapor field. */
(function () {
  "use strict";
  var C = window.R717;

  var FOG_VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  var FOG_FS = [
    "precision mediump float;",
    "uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;",
    "float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);",
    "return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}",
    "float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);",
    "for(int i=0;i<OCT;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}",
    "void main(){",
    " vec2 uv=gl_FragCoord.xy/uRes; vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;",
    " float t=uTime*.03;",
    " vec2 q=vec2(fbm(p*1.5+vec2(0.,t)),fbm(p*1.5+vec2(5.2,-t*.8)));",
    " vec2 r=vec2(fbm(p*2.1+3.*q+vec2(1.7,9.2)+t*.6),fbm(p*2.1+3.*q+vec2(8.3,2.8)-t*.4));",
    " float f=fbm(p*1.7+2.4*r+uMouse*.12);",
    " float ground=smoothstep(.62,-.1,uv.y);",
    " vec3 deep=vec3(.02,.04,.08),mid=vec3(.045,.13,.23),frost=vec3(.42,.86,.96),warm=vec3(1.,.62,.28);",
    " vec3 col=mix(deep,mid,smoothstep(.15,.85,f));",
    " col=mix(col,frost*.62,smoothstep(.5,1.05,f)*(.38+.62*ground));",
    " col+=frost*.10*ground*smoothstep(.3,.9,f);",
    " col+=frost*.05*smoothstep(.6,1.,length(r));",
    " col+=warm*.04*smoothstep(.55,1.,uv.x)*smoothstep(.4,1.,uv.y)*f;",
 " float vig=smoothstep(1.3,.2,length(p*vec2(.85,1.1)));",
    " col*=.5+.5*vig;",
    " col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.016;",
    " gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");
  var PT_VS = [
    "attribute vec4 s;uniform float uTime;uniform float uScale;varying float vA;",
    "void main(){",
    " float t=uTime;",
    " float y=fract(s.y+t*s.z*.010);",
    " float x=fract(s.x+sin(t*.18*s.z+s.y*20.)*.018+t*.003*(s.z-.5));",
    " gl_Position=vec4(x*2.-1.,y*2.-1.,0.,1.);",
    " gl_PointSize=(1.2+s.w*3.4)*uScale;",
    " vA=(.18+.7*s.w)*smoothstep(0.,.18,y)*smoothstep(1.,.65,y)*(.55+.45*sin(t*1.1+s.x*60.));",
    "}"
  ].join("\n");
  var PT_FS = "precision mediump float;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d)*vA;gl_FragColor=vec4(vec3(.78,.95,1.)*a,a);}";

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  function program(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  C.register("hero", function () {
    var canvas = document.getElementById("heroGL");
    if (!canvas) return;
    var gl;
    try { gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "low-power" }); } catch (e) { gl = null; }
    if (!gl) { canvas.style.display = "none"; return; }

    var mobile = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
    var oct = mobile ? 4 : 5, scale = mobile ? 0.5 : 0.62;
    var fog, pts;
    try {
      fog = program(gl, FOG_VS, "#define OCT " + oct + "\n" + FOG_FS);
      pts = program(gl, PT_VS, PT_FS);
    } catch (e) { canvas.style.display = "none"; return; }

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var N = mobile ? 260 : 520, seeds = new Float32Array(N * 4);
    for (var i = 0; i < N * 4; i++) seeds[i] = Math.random();
    var sb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

    var U = {
      res: gl.getUniformLocation(fog, "uRes"), time: gl.getUniformLocation(fog, "uTime"), mouse: gl.getUniformLocation(fog, "uMouse"),
      pt: gl.getUniformLocation(pts, "uTime"), ps: gl.getUniformLocation(pts, "uScale")
    };
    var aP = gl.getAttribLocation(fog, "p"), aS = gl.getAttribLocation(pts, "s");
    var mouse = [0, 0], target = [0, 0], t = 12 + Math.random() * 40;

    function resize() {
      var r = canvas.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2) * scale;
      var w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
      var cap = 1.4e6;                       // keep the fog shader cheap on big high-DPI screens
      if (w * h > cap) { var k = Math.sqrt(cap / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    }
    function draw() {
      gl.disable(gl.BLEND);
      gl.useProgram(fog);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(aP);
      gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, t);
      gl.uniform2f(U.mouse, mouse[0], mouse[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(aP);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(pts);
      gl.bindBuffer(gl.ARRAY_BUFFER, sb);
      gl.enableVertexAttribArray(aS);
      gl.vertexAttribPointer(aS, 4, gl.FLOAT, false, 0, 0);
      gl.uniform1f(U.pt, t);
      gl.uniform1f(U.ps, Math.max(1, canvas.width / 1100));
      gl.drawArrays(gl.POINTS, 0, N);
      gl.disableVertexAttribArray(aS);
    }

    // adaptive quality: if frames are slow, render at a lower resolution
    var slow = 0, frames = 0;
    var loop = new C.Loop(canvas, function (dt) {
      t += dt;
      mouse[0] += (target[0] - mouse[0]) * Math.min(1, dt * 2);
      mouse[1] += (target[1] - mouse[1]) * Math.min(1, dt * 2);
      draw();
      frames++;
      if (dt > 0.024) slow++;
      if (frames === 90) {
        if (slow > 45 && scale > 0.34) { scale *= 0.72; resize(); }
        frames = 0; slow = 0;
      }
    });
    window.addEventListener("pointermove", function (e) {
      target[0] = (e.clientX / window.innerWidth - 0.5) * 2;
      target[1] = (e.clientY / window.innerHeight - 0.5) * -2;
    }, { passive: true });
    window.addEventListener("resize", function () { resize(); if (!loop.id) draw(); });
    C.bus.addEventListener("motion", function () { if (C.Motion.reduced) draw(); });
    resize();
    draw();     // a single still frame for reduced motion, and the first frame for everyone
  });
})();
