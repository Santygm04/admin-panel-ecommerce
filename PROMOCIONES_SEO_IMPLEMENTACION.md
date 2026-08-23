# Promociones y SEO

Implementación basada en `SUPER_PROMPT_Cinta_Promocional_SEO.md` para el storefront, backend y panel AESTHETIC.

## Promociones

La cinta usa una entidad separada `Promotion`; no modifica `Producto.promo`, que sigue representando descuentos de precio.

### API

- `GET /api/promotions/active`: promociones activas y vigentes para el storefront.
- `GET /api/promotions/:id`: detalle público vigente para landings con productos asociados.
- `GET /api/promotions`: listado CRUD autenticado.
- `POST /api/promotions`: crear.
- `PUT /api/promotions/:id`: editar.
- `PATCH /api/promotions/:id/toggle`: activar o desactivar.
- `DELETE /api/promotions/:id`: eliminar.

La prioridad más alta aparece primero. Los colores de la primera promoción vigente se aplican a toda la cinta cuando hay varios mensajes.

### Prueba manual

1. Iniciar backend, storefront y panel con sus respectivos `VITE_API_URL`.
2. Iniciar sesión como administradora y abrir `Promociones`.
3. Crear una promoción con texto, fechas, estado activo y uno o varios productos.
4. Confirmar que el listado muestra estado, vigencia, cantidad y prioridad.
5. Abrir el storefront y verificar la cinta antes del navbar.
6. Verificar pausa al pasar el mouse y botón de pausa/reanudar en celular.
7. Probar destino a un producto, categoría, URL y landing `/promocion/:id`.
8. Desactivar, cambiar la fecha a vencida y eliminar una promoción.

## SEO implementado

- `robots.txt` permite el storefront y bloquea `/api/`, `/admin`, `/carrito`, `/pago/` y `/pedidos`.
- `sitemap.xml` es un índice con `sitemap-estatico.xml` y `sitemap-productos.xml`.
- El sitemap dinámico incluye todos los productos visibles y se expone mediante rewrite de Vercel.
- Las rutas principales tienen title, description, canonical, Open Graph y Twitter Cards.
- Home incluye `Organization`/`LocalBusiness`; producto incluye `Product`/`Offer`; las páginas aplicables incluyen `BreadcrumbList`.
- Las rutas privadas reciben `noindex, nofollow`; no hay `X-Robots-Tag: noindex` configurado.
- Cards e imágenes secundarias usan lazy-loading y las fuentes usan `display=swap`.
- Vercel redirige `www.aestheticmakeup.com.ar` al dominio canónico.
- Se conservan las URLs `/producto/:id` existentes para no romper enlaces.

## Google Search Console

1. Crear la propiedad de dominio `aestheticmakeup.com.ar` en Search Console.
2. Agregar el registro TXT DNS que Google entregue y verificar el dominio.
3. En `Indexación > Sitemaps`, enviar `sitemap.xml`.
4. Confirmar la URL completa `https://aestheticmakeup.com.ar/sitemap.xml`.
5. Solicitar indexación para `/`, `/category`, `/promos`, `/catalog`, `/contacto`, `/envios` y productos visibles prioritarios.
6. Revisar `Indexación > Páginas` para errores 4xx/5xx, exclusiones y páginas indexadas.
7. Verificar después de varios días con `site:aestheticmakeup.com.ar`.

Para verificación por meta tag, agregar el token de Google como `VITE_GOOGLE_SITE_VERIFICATION` al `.env` del storefront y volver a desplegar. El token debe ser generado por Search Console y no se puede inventar desde el código.

## Comandos

```text
cd AESTHETIC/AESTHETIC-ECOMMERCE
npm run build
npm run lint

cd AESTHETIC-PANEL-ADMIN/aesthetic-admin-panel
npm run build

cd AESTHETIC-BACKEN/aesthetic-admin-backend
npm test
node --check models/Promotion.js
node --check routes/promotions.js
node --check index.js
node --check routes/productos.js
```
