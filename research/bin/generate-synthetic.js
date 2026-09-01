#!/usr/bin/env node
'use strict'
const { writeJsonl, parseArgs } = require('../lib/io'); const { SCHEMA } = require('../lib/dataset')
const a=parseArgs(process.argv.slice(2)); if(!a.output) throw new Error('usage: generate-synthetic --output FILE [--seed 42]')
let state=Number(a.seed||42)>>>0; const rand=()=>{state=(1664525*state+1013904223)>>>0; return state/4294967296}; const base=Date.UTC(2026,0,1,12,0,0); const R=6371000; const scenarios=[
 {id:'head-on',a:{m:'111111111',x:-2500,y:0,v:5,c:Math.PI/2},b:{m:'222222222',x:2500,y:0,v:5,c:3*Math.PI/2}},
 {id:'crossing',a:{m:'333333333',x:-1800,y:0,v:4,c:Math.PI/2},b:{m:'444444444',x:0,y:-1800,v:4,c:0}},
 {id:'overtaking',a:{m:'555555555',x:-1200,y:300,v:6,c:Math.PI/2},b:{m:'666666666',x:0,y:300,v:3,c:Math.PI/2}},
 {id:'diverging',a:{m:'777777777',x:0,y:0,v:4,c:Math.PI},b:{m:'888888888',x:400,y:0,v:4,c:Math.PI/2}}
]; const rows=[]; let offset=0
for(const s of scenarios){for(let sec=0;sec<=1200;sec+=10){for(const v of [s.a,s.b]){const t=base+offset+sec*1000; const jitter=(rand()-.5)*1.2; const x=v.x+v.v*Math.sin(v.c)*sec+jitter; const y=v.y+v.v*Math.cos(v.c)*sec+jitter; rows.push({schema:SCHEMA,t,mmsi:v.m,position:{latitude:40+y/R*180/Math.PI,longitude:14+x/(R*Math.cos(40*Math.PI/180))*180/Math.PI},speed:v.v+(rand()-.5)*0.02,course:v.c+(rand()-.5)*0.002,source:'synthetic-v1',scenario:s.id})}} offset+=1800*1000}
rows.sort((x,y)=>x.t-y.t||x.mmsi.localeCompare(y.mmsi)); writeJsonl(a.output,rows); console.log(JSON.stringify({observations:rows.length,scenarios:scenarios.length,seed:Number(a.seed||42),output:a.output}))
