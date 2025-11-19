// webSockets2.js

/**
 * Esta clase existe para satisfacer un requerimiento de 
 * comunicación crítico.
 * La otra clase no se diseñó con tanta anticipación, provocando
 * que esta clase sea generada.
 * 
 * ESTE ES UN RECORDATORIO QUE, O ESTA CLASE SE INCORPORA
 * A LA OTRA, O LA OTRA A ESTA. ¡PERO NO DEJAR AMBAS!
 */


export class WebSockets2 {

    constructor () {
        // User?
        this.window_url = window.location.origin
    }

    show_url() {
        return this.window_url
    }
}