import { Mode } from './types';
import { writable, get } from 'svelte/store'
import { addEventListener, messageServer } from "@/lib/socket";
import { prompt, mode, learningRate, lastOptimizationResult, mainCanvas, maskCanvas, stylePrompt, numRecSteps } from './stores'
import { imgTob64 } from './utils';

interface StartGenerationData {
    prompt: string
    stylePrompt: string,
    imageBase64: string,
    learningRate: number,
    backgroundImg: string,
    numRecSteps: number | null
}

function getGenerationData():StartGenerationData {
    return {
        prompt: get(prompt),
        stylePrompt: get(stylePrompt)??'',
        learningRate: get(learningRate) / 1000,
        imageBase64: get(maskCanvas).canvasBase64,
        backgroundImg: get(mainCanvas).canvasBase64,
        numRecSteps: get(numRecSteps),
    }
}

function validateGenerationData(data:StartGenerationData) {
    for (const [key, value] of Object.entries(data)) {
        if (key == 'stylePrompt') {
            continue
        }
        if (key == 'numRecSteps') {
            continue
        }
        if (!value || value.length == 0) {
            throw new Error(`Empty value for: ${key}.`)
        }
    }
}

export function start() {
    const data = getGenerationData()
    validateGenerationData(data)
    messageServer('start-generation', data)
    mode.set(Mode.Optimizing)
}

export function discard() {
    messageServer("stop-generation", {})
    lastOptimizationResult.set(null)
    mode.set(Mode.MaskDraw)
}

export function accept() {
    messageServer("stop-generation", {})
    get(mainCanvas).set(get(lastOptimizationResult))
    lastOptimizationResult.set(null)
    mode.set(Mode.MaskDraw)
}

export function upscale() {
    const data = getGenerationData()
    data.backgroundImg = imgTob64(get(lastOptimizationResult))
    validateGenerationData(data)
    messageServer('upscale-generation', data)
    mode.set(Mode.Optimizing)
}

export function pause() {
    // TODO
    // messageServer("pause-generation", {})
    messageServer("stop-generation", {})
    mode.set(Mode.PausedOptimizing)
}

export function resume() {
    // TODO
    // messageServer("resume-generation", {})
    // like start() but use lastOptimizationResult instead of main canvas
    const data = getGenerationData()
    data.backgroundImg = imgTob64(get(lastOptimizationResult))
    validateGenerationData(data)
    messageServer('resume-generation', data)
    mode.set(Mode.Optimizing)
}

addEventListener("message", (e) => {
    console.log("MESSAGE RECEIVED!")
    const message = JSON.parse(e.data)
    if (get(mode) !== Mode.Optimizing) {
        // If we get a message from the server after the user can paused.
        return
    }
    if (message.image) {
        console.log("IMAGE RECEIVED!")
        const newImage = new Image()
        newImage.src = "data:text/plain;base64," + message.image
        lastOptimizationResult.set(newImage)
    } else {
        console.log("NO IMAGE RECEIVED!")
    }
});