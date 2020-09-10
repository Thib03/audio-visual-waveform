var black = 0;
var white = 255;

var dimension;
var weight = 0.005;
var bigRadius = 0.35;
var littleRadius = 0.0905;

var velocity = [];
for(let n = 0; n < 7; n++) {
  velocity.push(0);
}

var number = [];
for(let n = 0; n < 75; n++) {
  number.push(0);
}

var notesOn = [];
for(let n = 0; n < 7; n++) {
  notesOn.push([]);
}

var notes = [];
var millisecond = 0;
var notePressed = -1;

var midiHandler;
var midi = 0;
var midiRadius = 0.35*littleRadius;

var midiInput, midiOutput;

var hasSequencer = false;
var hasKeylinder = false;
var sequencerOutput;
var keylinderOutput;

var launchpad;

var noteOnStatus     = 144;
var noteOffStatus    = 128;
var aftertouchStatus = 160;

var synth;

var fontLight, font, fontBold;

var fundamental = 84;

var tritons = [];

for(let i = 0; i < 6; i++) {
  tritons[i] = false;
}

let t1 = 0.01;
let l1 = 1; // velocity
let t2 = 0.01;
let l2 = 0.5; // aftertouch
let t3 = 0.3;
let l3 = 0;

var fonDeg = 0;
//var fonNum = 130;
var nextNote = false;

var dragX, dragY, dragDist;
var dragLimit = 0.1;

var midiScale = [[]];

var maxFreq = 10000;

class Graph {
  constructor() {
    this.size(dimension/2);
    this.position(width/2,height/2);
  }

  size(w) {
    this.w = w;
    this.h = 2*w/3;
  }

  position(x,y) {
    this.x = x;
    this.y = y;
  }

  plot(f) {
    this.f = f;
    this.hasF = true;
  }

  dontPlot() {
    this.hasF = false;
  }

  draw() {
    noFill();
    stroke(0);
    rect(this.x-this.w/2,this.y-this.h/2,this.w,this.h);
    let r = 5;
    if(this.hasF) {
      let resize = 2*Math.max(abs(Math.max(...this.f)),abs(Math.min(...this.f)));
      beginShape();
      for(let t = 0; t < this.f.length; t++) {
        vertex(this.x-this.w/2+t*this.w/(this.f.length-1),
               this.y-r/2-this.f[t]/resize*(this.h-r)+r/2);
      }
      endShape();
    }
  }
}

class Voice {
  constructor() {
    this.pit = -1;
    this.osc = new p5.Oscillator();
    this.env = new p5.Envelope();

    this.osc.setType('sine');
    this.osc.amp(this.env);
    this.osc.start();
  }
}

class PolySynth {
  constructor(num) {
    this.voices = [];
    this.reverb = new p5.Reverb();
    for(let v = 0; v < num; v++) {
      this.voices.push(new Voice());
      this.reverb.process(this.voices[v].osc,1,2);
    }
  }

  noteAttack(pit,vel) {
    var frq = 16.3515*exp(pit*log(2)/12);
    var voi = -1;
    for(let v = 0; v < this.voices.length; v++) {
      var voice = this.voices[v];
      if(voice.pit == pit) {
        voi = v;
        break;
      }
    }
    if(voi == -1) {
      for(let v = 0; v < this.voices.length; v++) {
        var voice = this.voices[v];
        if(voice.pit == -1) {
          voi = v;
          break;
        }
      }
    }
    if(voi >= 0) {
      var voice = this.voices[voi];
      voice.pit = pit;
      voice.osc.freq(frq);
      voice.env.set(t1,vel,t2,l2*vel,t3,l3);
      voice.env.triggerAttack();
    }
    else {
      console.log('Maximum number of voices reached.');
    }
  }

  noteAftertouch(pit,vel) {
    for(let v = 0; v < this.voices.length; v++) {
      var voice = this.voices[v];
      if(voice.pit == pit) {
        voice.env.ramp(voice[1],0,l2*vel);
        break;
      }
    }
  }

  noteRelease(pit) {
    for(let v = 0; v < this.voices.length; v++) {
      var voice = this.voices[v];
      if(voice.pit == pit) {
        voice.pit = -1;
        voice.env.triggerRelease();
        break;
      }
    }
  }
}

class MidiHandler {
  constructor() {
    this.button = new Clickable();
    this.button.color = white;
    this.button.cornerRadius = 1000;
    this.button.stroke = black;
    this.button.text = '';
    this.button.onPress = function() {
      enableMidi();
    }
    this.position(width/2,height/2);
    this.update();
  }

  update() {
    let r = midiRadius*dimension;
    this.button.resize(2*r,2*r);
    this.adjustY = 0.021*dimension;
    this.button.locate(this.x-r,
                       this.y-r+this.adjustY);
    this.button.strokeWeight = weight*dimension;
  }

  position(x,y) {
    this.x = x;
    this.y = y;
    this.update();
  }

  draw() {
    this.button.draw();

    noStroke();
    fill(this.button.color==white?black:white);
    let r  = 0.14*midiRadius*dimension;
    let br = 0.6*midiRadius*dimension;
    for(let n = 0; n < 5; n++) {
      let a = n*PI/4;
      circle(this.x+br*cos(a),this.y-br*sin(a)+this.adjustY,2*r,2*r);
    }
    let l = 0.7*midiRadius*dimension;
    let h = 0.35*midiRadius*dimension;
    rect(this.x-l/2,this.y+1.1*br+this.adjustY,l,h,h);
  }
}

function preload() {
  fontLight = loadFont('nunito_extralight.ttf');
  font     = loadFont('nunito_light.ttf');
  fontBold = loadFont('nunito_semibold.ttf');
}

/*var buf = new Float32Array( 1024 );
var MIN_SAMPLES = 0;
var GOOD_ENOUGH_CORRELATION = 0.9;*/

let input, button, greeting;

var f = [];
var graph;

function processText() {
  let entry = input.value();
  if(entry == '') {
    graph.dontPlot();
    return;
  }
  for(let i = 0; i < 1000; i++) {
    t = i/1000;
    f[i] = eval(entry);
  }
  graph.plot(f);
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  dimension = Math.min(width,height);

  /*mic = new p5.AudioIn()
  mic.start();
  fft = new p5.FFT();
  fft.setInput(mic);*/

  userStartAudio().then(function() {
     console.log('Audio ready');
  });

  input = createInput();
  input.position(width/2-input.width/2, height/2+dimension/4.2);

  button = createButton('submit');
  button.position(input.x + input.width, input.y);
  button.mousePressed(processText);

  midiHandler = new MidiHandler();
  midiHandler.position(width/2,height/2+dimension/2.8);

  graph = new Graph();
  graph.position(width/2,height/2-dimension/7);
  graph.size(0.9*dimension);
}

function draw() {
  background(white);

  graph.draw();

  if(!midi) {
    midiHandler.draw();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  dimension = Math.min(width,height);

  midiHandler.update();
}

//------------------------------------------------------------------------------
//                             MIDI
//------------------------------------------------------------------------------

function enableMidi() {
  WebMidi.enable(function (err) {
    if (err) console.log("An error occurred", err);

    //---------------------INPUT--------------------

    var liste = '';
    var taille = WebMidi.inputs.length;
    var i, num;
    var numStr = '0';

    if(taille == 0) {
      window.alert("No MIDI input device detected.");
      disableMidi();
      return;
    }

    for(let i = 0; i < taille; i++) {
      num = i+1;
      var name = WebMidi.inputs[i].name;
      liste += '   ' + num.toString() + '   -   ' + name + '\n';
      if(name.includes('Progression')) {
        if(!WebMidi.inputs[i].hasListener('noteon',      'all', handleScale)) {
          WebMidi.inputs[i].addListener('noteon',        'all', handleScale);
        }
      }
      else if(name.includes('Keylinder output')) {
        if(!WebMidi.inputs[i].hasListener('noteon',      'all', handleKeylinder)) {
          WebMidi.inputs[i].addListener('noteon',        'all', handleKeylinder);
        }
        console.log('Keylinder input ok');
      }
    }

    i = 0;
    num = 0;

    while((num < 1 || num > taille) && i < 1) {
      numStr = window.prompt("Write the number of the desired MIDI input device:\n\n"+liste);
      if(numStr == null)
      {
        num = 0;
        break;
      }
      else if(numStr) num = parseInt(numStr);
      i++;
    }

    if(num < 0 || !num || num > taille) {
      window.alert("No MIDI input selected. MIDI disabled.");
      disableMidi();
      return;
    }
    else {
      midiInput = WebMidi.inputs[num-1];
      let name = midiInput.name;
      /*if(name == 'MIDIIN2 (Launchpad Pro)') {
        launchpad.turnOn('MIDIOUT2 (Launchpad Pro)');
        name += '.\nColours will be displayed on the matrix. Please put your Launchpad Pro into Programmer Mode';
      }*/
      if(name.includes('Launchpad Pro')) {
        let x = (WebMidi.inputs[num-2].name.includes('Launchpad Pro'));
        let y = (WebMidi.inputs[num  ].name.includes('Launchpad Pro'));
        var offset;
        if(!x && y) {
          offset = 0;
        }
        else if(x && y) {
          offset = 1;
        }
        else {
          offset = 2;
        }
        taille = WebMidi.outputs.length;
        for(let o = 0; o < taille-2; o++) {
          if(WebMidi.outputs[o  ].name.includes('Launchpad Pro') &&
             WebMidi.outputs[o+1].name.includes('Launchpad Pro') &&
             WebMidi.outputs[o+2].name.includes('Launchpad Pro')) {
            launchpad.turnOn(o+offset);
            name += '.\nColours will be displayed on the matrix. Please put your Launchpad Pro into Programmer Mode';
            taille -= 3;
            break;
          }
        }
      }
      else if(name.includes('Launchpad Note')) {
        launchpad.turnOn('Launchpad Note');
        name += '.\nColours will be displayed on the matrix. Please put your Launchpad Pro into Programmer Mode';
      }
      window.alert('Input selected: ' + name + '.');
      if(!midiInput.hasListener('noteon',      'all', handleNoteOn)) {
        midiInput.addListener('noteon',        'all', handleNoteOn);
        midiInput.addListener('keyaftertouch', 'all', handleAftertouch);
        midiInput.addListener('noteoff',       'all', handleNoteOff);
        midiInput.addListener('controlchange', 'all', handleControl);
      }
      midi = 1;
      //midiButton.color  = black;
      //midiButton.stroke = white;
    }

    //--------------------OUTPUT--------------------

    liste = '';
    //taille = WebMidi.outputs.length;
    numStr = '0';

    if(taille == 0) {
      window.alert("No MIDI output device detected. A sinewave polyphonic synth will be used as output.");
      synth = new PolySynth(6);
      return;
    }

    num = 1;
    for(let i = 0; i < taille; i++) {
      var name = WebMidi.outputs[i].name;
        liste += '   ' + num.toString() + '   -   ' + name + '\n';
        num++;
      if(name.includes('Sequencer')) {
        hasSequencer = true;
        sequencerOutput = WebMidi.outputs[i];
      }
      else if(name.includes('Keylinder input')) {
        keylinderOutput = WebMidi.outputs[i];
        console.log('Keylinder output ok');
        hasKeylinder = true;
        checkKeylinder();
      }
    }

    i = 0;
    num = 0;

    while((num < 1 || num > taille) && i < 1) {
      numStr = window.prompt("Write the number of the desired MIDI output device:\n\n"+liste+"\nCancel this pop-up to use the integrated synth.");
      if(numStr == null)
      {
        num = 0;
        break;
      }
      else if(numStr) num = parseInt(numStr);
      i++;
    }

    if(num < 0 || !num || num > taille) {
      window.alert("No MIDI output selected. A sinewave polyphonic synth will be used as output.");
      synth = new PolySynth(6);
      return;
    }
    else {
      midiOutput = WebMidi.outputs[num-1];
      window.alert('Output selected: ' + midiOutput.name + '.');
      midi = 2;
    }
  },true);
}

//--------------------EVENTS--------------------

var oct0 = 3;

function handleNoteOn(e) {
  var deg, oct;
  var num = e.note.number;
  if(launchpad.isOn) {
    let row = Math.floor(num/10)-1;
    let col = num%10-1;
    launchpad.noteOn(row,col);
    deg = (col+4*row)%7+1;
    oct = oct0+Math.floor((col+4*row)/7);
  }
  else {
    deg = ndtToDeg(num%12);
    oct = e.note.octave+1;
  }
  if(deg) {
    if(nextNote) {
      triggerColors(deg);
      checkKeylinder();
    }
    var vel = e.velocity;
    num = notes[deg-1].midiNumber(oct);
    number[7*oct+deg-1] = num;
    if(midi == 2) {
      midiOutput.send(e.data[0],[num,e.data[2]]);
    }
    else {
      synth.noteAttack(num,vel);
    }
    if(hasSequencer) {
      sequencerOutput.send(e.data[0],[7*oct+deg-1,fonDeg?(deg-fonDeg+7)%7+1:8]);
    }
    notesOn[deg-1].push([num,vel]);
    var l = notesOn[deg-1].length;
    if(l > 1) {
      var max = 0;
      var v;
      for(let i = 0; i < l; i++) {
        v = notesOn[deg-1][i][1];
        if(v > max) {
          max = v;
        }
      }
      velocity[deg-1] = max;
    }
    else {
      velocity[deg-1] = vel;
    }
    var n0 = notes[deg-1].n;
    for(var d = 1; d <= 7; d++) {
      if(d != deg && notesOn[d-1].length) {
        var n1 = ndt(notesOn[d-1][0][0]);
        if(ndt(n1-n0) == 6) {
          tritons[Math.min(n0,n1)] = true;
        }
      }
    }
  }
}

function handleAftertouch(e) {
  var deg, oct;
  var num = e.note.number;
  if(launchpad.isOn) {
    let row = Math.floor(num/10)-1;
    let col = num%10-1;
    deg = (col+4*row)%7+1;
    oct = oct0+Math.floor((col+4*row)/7);
  }
  else {
    deg = ndtToDeg(num%12);
    oct = e.note.octave+1;
  }
  if(deg) {
    var vel = e.value;
    num = number[7*oct+deg-1];
    if(midi == 2) {
      midiOutput.send(e.data[0],[num,e.data[2]]);
    }
    else {
      synth.noteAftertouch(num,vel);
    }
    var l = notesOn[deg-1].length;
    for(let i = 0; i < l; i++) {
      if(notesOn[deg-1][i][0] == num) {
        notesOn[deg-1][i][1] = vel;
        break;
      }
    }
    if(l > 1) {
      var max = 0;
      var v;
      for(let i = 0; i < l; i++) {
        v = notesOn[deg-1][i][1];
        if(v > max) {
          max = v;
        }
      }
      velocity[deg-1] = max;
    }
    else {
      velocity[deg-1] = vel;
    }
  }
}

function handleNoteOff(e) {
  var deg, oct;
  var row, col;
  var num = e.note.number;
  if(launchpad.isOn) {
    row = Math.floor(num/10)-1;
    col = num%10-1;
    deg = (col+4*row)%7+1;
    oct = oct0+Math.floor((col+4*row)/7);
  }
  else {
    deg = ndtToDeg(num%12);
    oct = e.note.octave+1;
  }
  if(deg) {
    num = number[7*oct+deg-1];

    /*if(midi == 2) {
      midiOutput.send(e.data[0],[num,e.data[2]]);
    }
    else {
      synth.noteRelease(num);
    }*/

    var l = notesOn[deg-1].length;
    for(let i = 0; i < l; i++) {
      if(notesOn[deg-1][i][0] == num) {
        notesOn[deg-1].splice(i,1);
        l--;
        break;
      }
    }

    var lm = 0;
    for(let i = 0; i < l; i++) {
      if(notesOn[deg-1][i][0] == num) {
        lm++;
      }
    }
    if(!lm) {
      if(midi == 2) {
        midiOutput.send(e.data[0],[num,e.data[2]]);
      }
      else {
        synth.noteRelease(num);
      }
      if(hasSequencer) {
        sequencerOutput.send(e.data[0],[7*oct+deg-1,e.data[2]]);
      }
      if(launchpad.isOn) {
        launchpad.noteOff(row,col);
      }
    }

    if(l >= 1) {
      var max = 0;
      var v;
      for(let i = 0; i < l; i++) {
        v = notesOn[deg-1][i][1];
        if(v > max) {
          max = v;
        }
      }
      velocity[deg-1] = max;
    }
    else {
      velocity[deg-1] = 0;

      var n0 = ndt(num);
      for(var d = 1; d <= 7; d++) {
        if(d != deg && notesOn[d-1].length) {
          var n1 = ndt(notesOn[d-1][0][0]);
          if(ndt(n1-n0) == 6) {
            tritons[Math.min(n0,n1)] = false;
          }
        }
      }
    }
  }
}

function handleControl(e) {
  if(launchpad.isOn) {
    if(e.controller.number == 10) {
      if(e.value == 127) {
        nextNote = true;
        launchpad.output.send(noteOnStatus,[10,3]);
      }
      else if(nextNote) {
        nextNote = false;
        launchpad.output.send(noteOnStatus,[10,degToColor(1,true)]);
      }
    }
    else if(fonDeg) {
      for(var d = 2; d <= 7; d++) {
        if(e.controller.number == d*10) {
          if(e.value == 127) {
            launchpad.output.send(noteOnStatus,[d*10,3]);
            var n = (fonDeg+d-2)%7;
            var nAv = ndt(notes[n].n-notes[(n+6)%7].n)-1;
            var nAp = ndt(notes[(n+1)%7].n-notes[n].n)-1;
            if(nAv && !nAp) {
              notes[n].n = ndt(notes[n].n-1);
            }
            else if(!nAv && nAp) {
              notes[n].n = ndt(notes[n].n+1);
            }
            else if(nAv && nAp) {
              var a = alt(ndt(notes[n].n-notes[fonDeg-1].n)-degToNdt(notes[n].d-notes[fonDeg-1].d+1));
              if(a > 0 || (!a && d != 4)) {
                notes[n].n = ndt(notes[n].n-1);
              }
              else { // a < 0
                notes[n].n = ndt(notes[n].n+1);
              }
            }
            notes[n].angle = PI/2 - notes[n].n*PI/6;
            notes[n].updateText();
            notes[n].update();
            checkKeylinder();
          }
          else {
            launchpad.output.send(noteOnStatus,[d*10,degToColor(d,true)]);
          }
        }
      }
      /*if(e.controller.number == 80) {
        if(e.value == 127) {
          launchpad.output.send(noteOnStatus,[80,3]);
        }
        else {
          launchpad.output.send(noteOnStatus,[80,0]);
        }
      }*/
    }
  }
}

function handleScale(e) {
  if(hasSequencer) {
    sequencerOutput.send(e.data[0],[e.data[1],e.data[2]]);
  }
  if(millis()-millisecond > 20) {
    millisecond = millis();
    midiScale = [[e.note.number,e.rawVelocity]];
  }
  else {
    midiScale.push([e.note.number,e.rawVelocity]);
  }
  if(midiScale.length == 7) {
    midiScale.sort(function (a, b) {
      return a[0] - b[0];
    });
    triggerColors(midiScale[0][1],true);
    checkKeylinder();
    let i = fonDeg-1;
    for(let d = 1; d <= 7; d++) {
      var note = notes[i];
      note.n = midiScale[d-1][0]%12;
      note.angle = PI/2 - note.n*PI/6;
      note.updateText();
      note.update();
      i++;
      i %= 7;
    }
  }
}

function checkKeylinder() {
  if(!hasKeylinder) return;
  fundamental = 84;
  if(fonDeg) {
    var newScale = [];
    for(let d = 0; d < 7; d++) {
      newScale.push(ndt(notes[deg(fonDeg+d)-1].n-notes[fonDeg-1].n));
    }
    var fMod = 7;
    if(newScale[1] == 1 &&
       newScale[2] == 3 &&
       newScale[3] == 5 &&
       newScale[5] == 8 &&
       newScale[6] == 10) {
      if(newScale[4] == 6) {
        fMod = 6;
      }
      else if(newScale[4] == 7) {
        fMod = 2;
      }
    }
    else if(newScale[1] == 2 &&
            newScale[4] == 7) {
      if(newScale[2] == 4 &&
         newScale[5] == 9) {
        if(newScale[3] == 5) {
          if(newScale[6] == 10) {
            fMod = 4;
          }
          else if(newScale[6] == 11) {
            fMod = 0;
          }
        }
        else if(newScale[3] == 6 &&
                newScale[6] == 11) {
          fMod = 3;
        }
      }
      else if(newScale[2] == 3 &&
              newScale[3] == 5 &&
              newScale[6] == 10) {
        if(newScale[5] == 8) {
          fMod = 5;
        }
        else if(newScale[5] == 9) {
          fMod = 1;
        }
      }
    }
    if(fMod != 7) {
      var fMaj;
      var tempN = notes[deg(fonDeg-fMod)-1].n;
      var i = 0;
      while(ndt(1+7*i) != tempN) {
        i++;
      }
      fMaj = i;
      fundamental = fMaj*7+fMod;
    }
  }
  keylinderOutput.send(noteOnStatus,[fundamental,100]);
}

function handleKeylinder(e) {
  let f = e.note.number;
  let d = (8+4*floor(f/7))%7+1;
  let a = 0;
  switch(floor(f/7)) {
    case 0:
    case 1:
    case 2:
    case 3: a = -1; break;
    case 11: a = 1; break;
  }
  triggerColors(deg(d+f%7),true);
  var major = [];
  for(let m = 0; m < 7; m++) {
    major.push(ndt(degToNdt(d)+degToNdt(m+1)-degToNdt(1)+a));
  }
  let i = fonDeg-1;
  for(relD = 1; relD <= 7; relD++) {
    var note = notes[i];
    //let newNdt = ndt(degToNdt(d+f%7)+degToNdt(relD+f%7)-degToNdt(f%7+1));
    note.n = major[deg(f%7+relD)-1];
    note.angle = PI/2 - note.n*PI/6;
    note.updateText();
    note.update();
    i++;
    i %= 7;
  }
}

function disableMidi() {
  midi = 0;

  for(let i = 0; i < WebMidi.inputs.length; i++) {
    WebMidi.inputs[i].removeListener();
  }

  WebMidi.disable();

  //midiButton.color  = white;
  //midiButton.stroke = black;
}

//----------------------------------------------------------------------------
//                        Pitch detection
//----------------------------------------------------------------------------

/*function autoCorrelate( buf, sampleRate ) {
          var SIZE = buf.length;
      var MAX_SAMPLES = Math.floor(SIZE/2);
          var best_offset = -1;
      var best_correlation = 0;
      var rms = 0;
      var foundGoodCorrelation = false;
      var correlations = new Array(MAX_SAMPLES);

for (var i=0;i<SIZE;i++) {
	var val = buf[i];
	rms += val*val;
}
rms = Math.sqrt(rms/SIZE);
if (rms<0.01) // not enough signal
	return -1;

var lastCorrelation=1;
for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
	var correlation = 0;

	for (var i=0; i<MAX_SAMPLES; i++) {
		correlation += Math.abs((buf[i])-(buf[i+offset]));
	}
	correlation = 1 - (correlation/MAX_SAMPLES);
	correlations[offset] = correlation; // store it, for the tweaking we need to do below.
	if ((correlation>GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
		foundGoodCorrelation = true;
		if (correlation > best_correlation) {
			best_correlation = correlation;
			best_offset = offset;
		}
	} else if (foundGoodCorrelation) {
		// short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
		// Now we need to tweak the offset - by interpolating between the values to the left and right of the
		// best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
		// we need to do a curve fit on correlations[] around best_offset in order to better determine precise
		// (anti-aliased) offset.

		// we know best_offset >=1,
		// since foundGoodCorrelation cannot go to true until the second pass (offset=1), and
		// we can't drop into this clause until the following pass (else if).
		var shift = (correlations[best_offset+1] - correlations[best_offset-1])/correlations[best_offset];
		return sampleRate/(best_offset+(8*shift));
	}
	lastCorrelation = correlation;
}
if (best_correlation > 0.01) {
	// console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
	return sampleRate/best_offset;
}
return -1;
   //	var best_frequency = sampleRate/best_offset;
 }*/
