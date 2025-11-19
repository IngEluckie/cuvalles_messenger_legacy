// notificaciones.js

// Pasarle el módulo barralatera para usar la recarga.
// acualizar el dom para que tenga o no un número en la notificación

// en chats, pasarle una instancia de eesta clase para que
// esta pueda ser capaz de recargar la barra lateral

// a la barra lateral hay que agregarlo más parámetros...

export class Notificaciones {

    constructor (barraLateralInstance, user) {
        // Debe llevar la instancia de barra lateral
        this.barraLateralInstance = barraLateralInstance
        // Debe llevar la instancia de user para hacer sonar las notificaciones
        this.user = user
    }

    reloadBarraLateral() {
        this.barraLateralInstance.reload()
    }

    funciona () {
        console.log("Notificaciones sí está funcionando")
    }
}