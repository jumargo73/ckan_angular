import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet,RouterLink } from '@angular/router';

console.log("0. Archivo app.ts leído por el navegador"); 

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,RouterLink], 
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('Buscador...');
 

  ngOnInit() {
    console.log("¡Angular está vivo!"); 
    window.addEventListener('unhandledrejection', (event) => {
      const errorMsg = event.reason?.message || '';
      if (errorMsg.includes('click') || errorMsg.includes('on')) {
        event.preventDefault(); 
        event.stopPropagation();
      }
    });

    // También silenciamos errores síncronos comunes de CKAN
    window.addEventListener('error', (event) => {
      if (event.message.includes('click') || event.message.includes('on')) {
        event.preventDefault();
        event.stopPropagation();
      }
      }, true);
    }  
}