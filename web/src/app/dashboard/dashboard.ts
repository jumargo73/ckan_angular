import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef ,Injectable } from '@angular/core';
import { CommonModule,SlicePipe } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { forkJoin } from 'rxjs';

console.log("0. Archivo dashboard.ts leído por el navegador"); // <-- Al principio del todo
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})

export class DashboardComponent implements OnInit		 {
	
	public query: string = '';
	public global = { datasets: 0, organizaciones: 0 , tematicas: 0,promedioRecursos: 0  }; // Estático (Panorama)
	public totales: any = { datasets: 0, organizaciones: 0, grupos: 0,huerfanos:0 };
	public estadisticaGrupos: any = { asociados: 0, sinAsociar: 0, porcentaje: 0 };
	public resultados: any[] = [];
	public resultadosBusqueda: any[] = [];	
	public cargando: boolean = false;
	private timeout: any;
	public formatosGrafico: any[] = [];
	public formatosGrupos : any[] = [];
	public stats_tematicas: any[] = [];
	public topGrupos: any[] = [];
	public topOrganizaciones : any[] = [];
	public recursosPorOrg: any[] = [];
	public total =0;
	public debugData: any; 
	
	
	private intervalo: any;	
	stats: any = null; 
	
	public resultadosHuerfanos: any[] = []; // Usa una variable específica para no mezclar
    public viendoHuerfanos: boolean = false;
	
	constructor(private http: HttpClient,private zone: NgZone, private cdr: ChangeDetectorRef) {}
  
	public metricas = {
	  totalDatasets: 0,
	  totalRecursos: 0,
	  formatos: {} as any
	};
	
	public privacidad = {
	  publicos: 0,
	  privados: 0,
	  porcentajePublico: 0
	};
	
	ngOnInit() { // <--- Aquí es donde debe ir tu bloque try/catch
		console.log("¡DashboardComponent Activo!"); 
		try {
			this.obtenerMetricasGlobales_api();
			this.iniciarIntervalo();
		} catch (e) {
			console.error("Error en la inicialización:", e);
		}
	}

	
	ngOnDestroy() {
	  if (this.intervalo) {
		clearInterval(this.intervalo);
	  }
	}

	// Función para procesar los resultados que ya traes de la API
	actualizarDashboard(resultadosBusqueda: any[]) {
	  this.metricas.totalDatasets = this.resultadosBusqueda.length;
	  this.metricas.totalRecursos = 0;
	  this.metricas.formatos = {};

	  this.resultados.forEach(ds => {
		this.metricas.totalRecursos += ds.num_resources || 0;
		
		// Contamos formatos para el futuro gráfico
		ds.resources?.forEach((res: any) => {
		  const fmt = res.format.toUpperCase();
		  this.metricas.formatos[fmt] = (this.metricas.formatos[fmt] || 0) + 1;
		});
	  });
	}

	private iniciarIntervalo() {
		this.zone.runOutsideAngular(() => {
			this.intervalo = setInterval(() => {
				this.zone.run(() => {
					this.obtenerMetricasGlobales_api();
				});
			}, 30000); 
		});
	}

	
	obtenerMetricasGlobales_api() {
	  this.cargando = true;
	  
	  // Ahora apuntamos a tu nuevo endpoint único
	  const url = '/api/3/action/dashboard_stats';
	  
	  // Ya no necesitas params complejos, el backend ya sabe qué contar
	  this.http.get<any>(url).subscribe({
		next: (response) => {
			console.log("--- CHEQUEO DE API ---");
			console.table("response:",response); // Mira si esto tiene filas
            
		  // Si tu backend devuelve el objeto directamente
		  if (response) {

			this.stats = response; // Aquí ya tienes huerfanos, privados, etc.
			console.table("this.stats:",this.stats); 
			this.totales.datasets=this.stats.total_datasets
			this.totales.tematicas=this.stats.total_grupos
			this.totales.organizaciones=this.stats.total_orgs
			
			this.privacidad.privados=this.stats.privados
			this.privacidad.publicos = this.totales.datasets - this.privacidad.privados;
			this.privacidad.porcentajePublico=this.stats.total_datasets > 0 ? (this.privacidad.publicos / this.stats.total_datasets) * 100 : 0
			
			this.totales.huerfanos = this.stats.huerfanos

			if (this.stats.organizacion_raw) {
				console.table("organizacion_raw:",this.stats.organizacion_raw); 
  			    this.prepararGraficoOrganizaciones_api(this.stats.organizacion_raw);
			}

			if (this.stats.grupos_raw) {
				console.table("grupos_raw:",this.stats.grupos_raw); 
  			    this.prepararGraficoGrupos_api(this.stats.grupos_raw);
			}

			// Si aún usas las funciones de gráficos, les pasas la data limpia
			if (this.stats.formatos_raw) {
			  console.table("formatos_raw:",this.stats.formatos_raw); 	
			  this.prepararGraficoFormatos_api(this.stats.formatos_raw);
			}

			if (this.stats.stats_tematicas) {
			  console.table("stats_tematicas:",this.stats.stats_tematicas); 	
			  this.prepararGraficoGruposResource_api(this.stats.stats_tematicas);
			}

		  }
		  this.cargando = false;
		  this.cdr.detectChanges();
		},
		error: (err) => {
		  console.error('Error al obtener métricas del dashboard:', err);
		  this.cargando = false;
		  this.cdr.detectChanges();
		}
	  });
	}

	prepararGraficoGruposResource_api(formatosObj: any[]) {		
		// "stats_tematicas": [{"titulo": "Educación","total_datasets": 1,"total_recursos": 1,"url_ver_mas": "/group/educacion"}]
		this.stats_tematicas = formatosObj.map(item => ({
			titulo: item.titulo,
			total_datasets: item.total_datasets,
			total_recursos: item.total_recursos,
			url_ver_mas: item.url_ver_mas
		}));		

	}

	prepararGraficoFormatos_api(formatosObj: any[]) {
	 
		// Esto lo hace compatible con tu lógica anterior
		// 1. Extraemos solo las categorías reales (ej: 'salud'), ignorando la meta-llave 'Total_Datasets'
		/*const items = Object.entries(formatosObj)
			.filter(([key]) => key !== 'Total_Datasets') 
			.map(([key, value]) => ({
				display_name: key,
				count: value as number
			}));*/

		// 1. Capturamos el valor del objeto 'total_recursos'
    	const objetoTotal = formatosObj.find(item => item.nombre === 'total_recursos');
    	const totalRecursosGlobal = objetoTotal ? objetoTotal.cantidad : 0;	

		// 2. Calculamos el total (ahora .reduce sí funcionará porque 'items' es una lista)
		const total = formatosObj.length;
		
		// 3. Mantenemos tu lógica original de mapeo y colores
		this.formatosGrafico = formatosObj
			.filter(item => item.nombre !== 'total_recursos' && item.nombre) 
			.map(item => ({
				nombre: item.nombre,
				cantidad: item.cantidad,
				porcentaje: total > 0 ? (item.cantidad / totalRecursosGlobal) * 100 : 0,
				color: this.obtenerColorFormat(item.nombre ? item.nombre.toString().toUpperCase().trim() : '')
			}))
			.sort((a, b) => b.cantidad - a.cantidad) // Ordenamos de mayor a menor
			.slice(0, 5); // Tomamos los 5 principales
	}

	obtenerColorFormat(fmt: string) {
		// Usamos el string limpio para buscar en el diccionario
		const colors: any = { 
			'CSV': '#2ecc71', 
			'PDF': '#e74c3c', 
			'JSON': '#f1c40f', 
			'XLS': '#3498db',
			'XLSX': '#3498db',
			'GEOJSON': '#9b59b6' 
		};
		return colors[fmt] || '#95a5a6';
	}
	
	prepararGraficoGrupos_api(formatosObj: any) {
		// "grupos_raw": {"Total_Datasets": 2, "educacion": 1,"salud": 1 }, Tipo de variable'
		const items = Object.entries(formatosObj)
			.filter(([key]) => key !== 'Total_Datasets') 
			.map(([key, value]) => ({
				display_name: key,
				count: value as number
			}));

		// 2. Tomamos el total directamente de la llave que ya viene en el objeto
		const totalGlobal = formatosObj.Total_Datasets || 0;

		// 3. Mapeamos para el gráfico y el HTML
		this.formatosGrupos = items.map(item => ({
			nombre: item.display_name,
			cantidad: item.count,
			totalGrupos: totalGlobal,
			porcentaje: totalGlobal > 0 ? (item.count / totalGlobal) * 100 : 0
		}));

		// 4. Actualizamos las estadísticas globales para tu HTML
		const sumaAsociados = items.reduce((acc, item) => acc + item.count, 0);
		
		this.estadisticaGrupos = {
			total: totalGlobal,
			asociados: sumaAsociados,
			sinAsociar: totalGlobal - sumaAsociados,
			porcentaje: totalGlobal > 0 ? (sumaAsociados / totalGlobal) * 100 : 0
		};

		console.log('Estadísticas Facet Grups procesadas:', this.estadisticaGrupos);
	}


	prepararGraficoOrganizaciones_api(formatosObj: any) {

	  	const items = Object.entries(formatosObj)
			.filter(([key]) => key !== 'Total_Datasets') 
			.map(([key, value]) => ({
				display_name: key,
				count: value as number
			}));

		// Calculamos el máximo para que la barra más larga sea el 100% visual
		const maxVal = Math.max(...items.map(i => i.count)) || 1;
		
		this.recursosPorOrg = items.map(item => ({
			nombre: item.display_name,
			total: item.count,
			ancho: (item.count / maxVal) * 100
		})).slice(0, 5);

		console.log('Estadísticas Facet Organizacion procesadas:', this.recursosPorOrg);
	}

	
	
	

	


	
	verListadoHuerfanos_api(){

		this.cargando = true;
	    this.viendoHuerfanos = true;
		this.resultadosHuerfanos = [];
		const url = '/api/3/action/dataset_huerfanos';
	  
		// Ya no necesitas params complejos, el backend ya sabe qué contar
		this.http.get<any>(url).subscribe({
			next: (response) => {
				if (response) {
					this.resultadosHuerfanos = response;
				}

				this.cargando = false;
		  		this.cdr.detectChanges();
			
			},
			error: (err) => {
			console.error('Error al obtener métricas del dashboard:', err);
			this.cargando = false;
			this.cdr.detectChanges();
			}
		});
	} 

}
