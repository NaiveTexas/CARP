        function criarTabelaMAC() {
        const tabela = document.getElementById('tabelaMacForm');
        const labels = [
            "DROP ALTITUDE", "TERRAIN ELEVATION", "TRUE ALTITUDE", "PRESSURE ALT. VARIATION", "PRESSURE ALTITUDE",
            "CORRECT DROP ALTITUDE", "TERRAIN ELEVATION", "INDICATED ALTITUDE", "TRUE ALT. TEMPERATURE", "IAS",
            "TRUE AIRSPEED (TAS)", "RATE OF FALL (RF)", "ADJUSTED RATE OF FALL", "ALT. ABOVE POINT IMPACT", "VERTICAL DISTANCE",
            "STABILIZATION ALTITUDE", "TIME OF FALL", "TIME OF FALL CONSTANT", "TOTAL TIME OF FALL", "BALLISTIC WIND",
            "DRIFT EFFECT", "DROP ALTITUDE WIND", "MAGNETIC COURSE", "DRIFT CORRECTION", "MAGNETIC HEADING",
            "GROUND SPEED", "EXIT TIME", "DECELERATION QUOTIENT", "FORWARD TRAVEL TIME", "FORWARD TRAVEL DISTANCE",
            "STOP WATCH DISTANCE", "STOP WATCH TIME", "USABLE DROP ZONE LENGTH", "USABLE DROP ZONE TIME", "RED LIGHT TIME"
        ];

        labels.forEach((label, index) => {
            let tr = document.createElement('tr');
            let itemNum = (index + 1).toString().padStart(2, '0');
            // Destaque visual em variáveis chaves para o Navegador
            if ([11, 19, 30, 32, 35].includes(index + 1)) tr.classList.add('highlight');

            tr.innerHTML = `<td>${itemNum}</td><td>${label}</td><td id="m${index + 1}">--</td>`;
            tabela.appendChild(tr);
        });
    }
/* 
   =============================
   ENGINENEERING FORMULAS
   =============================
*/
        function atmosfera(pressureAltitude, oat) {
            const T0 = 288.15;
            const L = 0.0065;
            const g = 9.80665;
            const R = 287.05;

            const h = pressureAltitude * 0.3048;
            const T = oat + 273.15;
            const p = 101325 * Math.pow(1 - (L * h) / T0, g / (R * L));
            const rho = p / (R * T);

            return { rho: rho, rho0: 1.225 };
        }

        function calcularCorrectDropAltitude(dropAlt, pressureAltitude, oat) {
            const a = atmosfera(pressureAltitude, oat);
            return dropAlt * Math.sqrt(a.rho / a.rho0);
        }

        function calcularTrueAltitudeTemperature(surfaceTemp, trueAltitude) {
            return surfaceTemp - 1.98 * (trueAltitude / 1000);
        }

        function calcularTAS(ias, pressureAltitude, oat) {
            const a = atmosfera(pressureAltitude, oat);
            return ias / Math.sqrt(a.rho / a.rho0);
        }

        function calcularARF(rateOfFall, pressureAltitude, oat) {
            const a = atmosfera(pressureAltitude, oat);
            return rateOfFall * Math.sqrt(a.rho0 / a.rho);
        }

/* 
   ===============================
   ENGINEERING CALCULATIONS
   ===============================
*/
        function lerEntradas() {
            return  {
                DA: parseFloat(document.getElementById('inDA').value),
                TE: parseFloat(document.getElementById('inTE').value),
                IAS: parseFloat(document.getElementById('inIAS').value),
                MC: parseFloat(document.getElementById('inMC').value),
                QNH: parseFloat(document.getElementById('inQNH').value),
                temp: parseFloat(document.getElementById('inTemp').value),
                Vento_kt: parseFloat(document.getElementById('inVentokt').value),
                Vento_dir: parseFloat(document.getElementById('inVentodir').value)
            };
        }

        function calcularAltitude(entradas) {
            const { DA, TE, QNH, temp } = entradas;

            const trueAlt = DA + TE;
            const trueAltTemp = Math.round(calcularTrueAltitudeTemperature(temp, trueAlt));
            const pressAltVar = Math.round((1013 - QNH) * 30);
            const pressAlt = trueAlt + pressAltVar;

            return {trueAlt, trueAltTemp, pressAltVar, pressAlt};
        }

        function calcularVelocidade(entradas, altitude) {
            const CDA = Math.round(calcularCorrectDropAltitude(entradas.DA, altitude.pressAlt, altitude.trueAltTemp));
            const TAS = Math.round(calcularTAS(entradas.IAS, altitude.pressAlt, altitude.trueAltTemp));
            const GS_ms = TAS * 0.5144; // KT para m/s
            const indAlt = CDA + entradas.TE;
            return {
                CDA,
                TAS,
                GS_ms,
                indAlt
            };
        }

        function calcularBalistica(entradas, altitude) { // Dados Balísticos do Exercício (T-10A Fardo 150 lbs)
            const { DA, temp } = entradas;
            const { pressAlt, trueAltTemp } = altitude;
            
            const RF = 14.3; // Ajustar por peso
            const adjustedRF = parseFloat(calcularARF(RF, pressAlt - (DA / 2), (temp + trueAltTemp) / 2).toFixed(1));
            const TFC = 5.4;
            const DQ = 1.6;
            const exitTime = 0.2;
            const FTT = DQ + exitTime; 
            const VD = 180; 
            const SA = DA - VD; 
            const TOF = parseFloat((SA / adjustedRF).toFixed(1));
            const TTF = parseFloat((TOF + TFC).toFixed(1));

            return {RF, adjustedRF, TFC, DQ, exitTime, FTT, VD, SA, TOF, TTF};
        }

        function normalizarAngulo(angulo) {

             angulo = ((angulo + 180) % 360 + 360) % 360 - 180;

            return angulo;
        }

      function calcularDriftEffect(entradas, balistica) {

            const vento_ms = entradas.Vento_kt * 0.514444;

            const anguloRelativo = normalizarAngulo(entradas.Vento_dir - entradas.MC);

            const rad = anguloRelativo * Math.PI / 180;

            const vento_HT = vento_ms * Math.cos(rad);
            const vento_traves = vento_ms * Math.sin(rad);

            const drift_effect = (entradas.Vento_kt * balistica.TTF)/1.96;

            const deltaLongitudinal = vento_HT * balistica.TTF;
            const deltaLateral = vento_traves * balistica.TTF;

            return {
                anguloRelativo,
                vento_HT,
                vento_traves,
                deltaLongitudinal,
                deltaLateral,
                drift_effect
    };
        }

        function calcularVetoresCARP_Grade(entradas, velocidade, balistica, zl, vetores)
        {
            const drift = calcularDriftEffect(entradas,balistica,vetores);

            const headKt = drift.vento_HT / 0.514444;

            const crossKt = drift.vento_traves / 0.514444;

            return {
                x:-(crossKt/5) * zl.incCirculo,
                y:-vetores.FTD - (headKt/5) * zl.incHT
            };
        }

        function calcularZL(velocidade, balistica) {
            
            const incCirculo = Math.round(balistica.TTF * 2.57222);
            const incHT = Math.round((balistica.TTF + balistica.FTT) * 2.57222);
            const stopWatchDist = 70;
            const dzLength = 980;
            const stopWatchTime = (stopWatchDist / velocidade.GS_ms).toFixed(1);
            const dzTime = (dzLength / velocidade.GS_ms).toFixed(1);
            const redLightTime =
                (
                    parseFloat(stopWatchTime) +
                    parseFloat(dzTime)
                ).toFixed(1);

            return {incCirculo, incHT, stopWatchDist, dzLength, stopWatchTime, dzTime, redLightTime};
}

        function calcularVetoresCARP(entradas, velocidade, balistica) {
            const FTD = Math.round((balistica.FTT * velocidade.TAS) / 1.96);

            const drift = calcularDriftEffect(entradas,balistica);

            const carp = {
                x: -drift.deltaLateral,
                y: -drift.deltaLongitudinal
            };

            return {FTD, drift, carp};
        }

        function atualizarMACForm(dados) {

            const {entradas, altitude, velocidade, balistica, zl, vento, vetores} = dados;

            const formatStr = (val, unit) => `${val} ${unit}`;

            document.getElementById('m1').textContent = formatStr(entradas.DA, "FT"); // Drop Altitude
            document.getElementById('m2').textContent = formatStr(entradas.TE, "FT"); // Terrain Elevation
            document.getElementById('m3').textContent = formatStr(altitude.trueAlt, "FT"); // True Altitude
            document.getElementById('m4').textContent = formatStr(altitude.pressAltVar, "FT"); // Pressure Altitude Variation
            document.getElementById('m5').textContent = formatStr(altitude.pressAlt, "FT"); // Pressure Altitude
            document.getElementById('m6').textContent = formatStr(velocidade.CDA, "FT"); // Correct Drop Altitude
            document.getElementById('m7').textContent = formatStr(entradas.TE, "FT"); // Terrain Elevation (repeated)
            document.getElementById('m8').textContent = formatStr(velocidade.indAlt, "FT"); // Indicated Altitude
            document.getElementById('m9').textContent = formatStr(altitude.trueAltTemp, "°C"); // True Altitude Temperature
            document.getElementById('m10').textContent = formatStr(entradas.IAS, "KT"); // Indicated Airspeed
            document.getElementById('m11').textContent = formatStr(velocidade.TAS, "KT"); // True Airspeed
            document.getElementById('m12').textContent = formatStr(balistica.RF, "FT/s"); // Rate of Fall
            document.getElementById('m13').textContent = formatStr(balistica.adjustedRF, "FT/s"); // Adjusted Rate of Fall
            document.getElementById('m14').textContent = formatStr(entradas.DA, "FT"); // Alt Above Point Impact
            document.getElementById('m15').textContent = formatStr(balistica.VD, "FT"); // Vertical Distance
            document.getElementById('m16').textContent = formatStr(balistica.SA, "FT"); // Stabilization Altitude
            document.getElementById('m17').textContent = formatStr(balistica.TOF, "s"); // Time of Fall
            document.getElementById('m18').textContent = formatStr(balistica.TFC, "s"); // Time of Fall Constant
            document.getElementById('m19').textContent = formatStr(balistica.TTF, "s"); // Total Time of Fall
            document.getElementById('m20').textContent = "0 KT"; //Ballistic Wind 
            document.getElementById('m21').textContent = "0 m"; // Drift Effect
            document.getElementById('m22').textContent = "0 KT"; // Drop Altitude Wind
            document.getElementById('m23').textContent = formatStr(entradas.MC, "°"); // Trocar por Track
            document.getElementById('m24').textContent = "0 °"; // Drift Correction
            document.getElementById('m25').textContent = formatStr(entradas.MC, "°");
            document.getElementById('m26').textContent = formatStr(velocidade.TAS, "KT"); //Trocar por Ground Speed
            document.getElementById('m27').textContent = formatStr(balistica.exitTime, "s");
            document.getElementById('m28').textContent = balistica.DQ;
            document.getElementById('m29').textContent = formatStr(balistica.FTT, "s");
            document.getElementById('m30').textContent = formatStr(vetores.FTD, "m");
            document.getElementById('m31').textContent = formatStr(zl.stopWatchDist, "m");
            document.getElementById('m32').textContent = formatStr(zl.stopWatchTime, "s");
            document.getElementById('m33').textContent = formatStr(zl.dzLength, "m");
            document.getElementById('m34').textContent = formatStr(zl.dzTime, "s");
            document.getElementById('m35').textContent = formatStr(zl.redLightTime, "s");
        }

        function calcularTudo() {

            const entradas = lerEntradas();
            const altitude = calcularAltitude(entradas);
            const velocidade = calcularVelocidade(entradas, altitude);
            const balistica = calcularBalistica(entradas, altitude);
            const zl = calcularZL(velocidade, balistica);
            const vento = calcularDriftEffect(entradas, balistica);
            const vetores = calcularVetoresCARP(entradas, velocidade, balistica);
            const vetoresGrade = calcularVetoresCARP_Grade(entradas, velocidade, balistica, zl, vetores);

            console.log(vetores);

            const dados = {entradas, altitude, velocidade, balistica, zl, vento, vetores, vetoresGrade};

            atualizarMACForm(dados);  

            renderizarGrafico(dados);
        }

/*
================================
CONFIGURAÇÕES GRÁFICAS
================================
*/

        const CONFIG = {

            // Canvas
            PIXELS_POR_METRO: 0.62,
            OFFSET_VERTICAL: -20,

            // Limites do gráfico
            DESLOCAMENTO_LATERAL: -500,

            // Eixo central
            EIXO_TOPO: -550,
            EIXO_BASE: 450,

            // Radiais
            RAIO_RADIAIS: 480,
            RAIO_ROTULOS: 515,

            // Escalas
            ESCALA_1_Y: 540,
            ESCALA_2_Y: 610,

            // Arcos
            ARCO_EXTERNO: 500,
            ROTULO_ARCO: 510,

            PRISMA: {
                EXTERNO: {
                    TOPO:      { x:  0,  y: -24 },
                    ESQUERDA:  { x: -22, y:  20 },
                    DIREITA:   { x:  22, y:  20 },
                    BORDA: 2.5
                },
                INTERNO: {
                    TOPO:      { x:  0,  y: -12 },
                    ESQUERDA:  { x: -8,  y: 6 },
                    DIREITA:   { x:  8,  y: 6 },
                    BORDA: 2,
                }
            },
            // Painel de Informações
            PAINEL_X: -550,
            PAINEL_Y: -550
        };
/*
    ================================
    MOTOR GRÁFICO
    ================================
*/

        function desenharRadiais(ctx, s, drawLine, dados) {

            const { entradas } = dados;

            const radiaisRelativas = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];

            ctx.font = '13px Arial';
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';

            for (let rRel of radiaisRelativas) {

                let hdgReal = (entradas.MC + rRel + 360) % 360;

                let rad = (rRel - 90) * Math.PI / 180;

                let x = Math.cos(rad) * s(CONFIG.RAIO_RADIAIS);
                let y = Math.sin(rad) * s(CONFIG.RAIO_RADIAIS);

                drawLine(0, 0, x, y, '#94a3b8', 1);

                ctx.fillText(hdgReal + "°", Math.cos(rad) * s(CONFIG.RAIO_ROTULOS), Math.sin(rad) * s(CONFIG.RAIO_ROTULOS) + 4);
            }

        }

        function desenharEixoCentral(ctx, s, drawLine, dados) {

            const { entradas } = dados;

            drawLine(0, s(CONFIG.EIXO_TOPO), 0, s(CONFIG.EIXO_BASE), 'black', 1.5);

            ctx.strokeRect(-25, s(CONFIG.EIXO_TOPO) - 24, 50, 24);

            ctx.font = 'bold 15px Arial';
            ctx.fillStyle = 'black';

            ctx.fillText(entradas.MC + "°", 0, s(CONFIG.EIXO_TOPO) - 7);

            ctx.fillText(((entradas.MC + 180) % 360) + "°", 0, s(CONFIG.EIXO_BASE) +15 );
        }

        function desenharGrid(ctx, s, drawLine) {

            for (let i = 1; i <= 4; i++) {

                let xM = i * 50;
                let xPx = s(xM);

                drawLine(xPx, s(CONFIG.DESLOCAMENTO_LATERAL), xPx, s(CONFIG.EIXO_BASE), '#16a34a', 1.2);
                drawLine(-xPx, s(CONFIG.DESLOCAMENTO_LATERAL), -xPx, s(CONFIG.EIXO_BASE), '#16a34a', 1.2);

                ctx.fillStyle = '#16a34a';
                ctx.fillText(xM, xPx, s(CONFIG.DESLOCAMENTO_LATERAL) + 5);
                ctx.fillText(xM, -xPx, s(CONFIG.DESLOCAMENTO_LATERAL) + 5);
            }

        }

        function desenharCirculos(ctx, s, dados) {

            const { zl } = dados;

            for (let i = 1; i <= 4; i++) {

                ctx.beginPath();

                ctx.arc(0, 0, s(i * zl.incCirculo), 0, 2 * Math.PI);

                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }

        }

        function desenharArcos(ctx, s, valorParaY, dados) {
                const { entradas, velocidade, zl, vetores } = dados;
                for (let i = -3; i <= 3; i++) {

                    let valEsq = -vetores.FTD - (i * zl.incHT);
                    let yMeters = valorParaY(valEsq);
                    let valDir = velocidade.TAS + (i * 5);
                    let isCenter = (i === 0);

                    const angulo = 5 * Math.PI / 180;
                    const inclinacao = Math.tan(angulo) * 500;

                    ctx.beginPath();
                    ctx.moveTo(s(-CONFIG.ARCO_EXTERNO), s(yMeters + inclinacao));
                    ctx.lineTo(0, s(yMeters));
                    ctx.lineTo(s(CONFIG.ARCO_EXTERNO), s(yMeters + inclinacao));

                    ctx.strokeStyle = '#2563eb';
                    ctx.lineWidth = isCenter ? 2.5 : 1;
                    ctx.stroke();

                    ctx.textAlign = 'right';

                    if (isCenter) {
                        ctx.strokeStyle = '#2563eb';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(
                            s(-CONFIG.ROTULO_ARCO) - 45,
                            s(yMeters + inclinacao) - 16,
                            45,
                            22
                        );
                    }

                    ctx.fillStyle = '#2563eb';
                    ctx.fillText(
                        valEsq,
                        s(-CONFIG.ROTULO_ARCO) - 5,
                        s(yMeters + inclinacao) + 5
                    );

                    ctx.textAlign = 'left';
                    if (isCenter) {
                        ctx.strokeStyle = '#2563eb';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(
                            s(CONFIG.ROTULO_ARCO),
                            s(yMeters + inclinacao) - 16,
                            40,
                            22
                        );
                    }
                    ctx.fillStyle = '#2563eb';
                    ctx.fillText(
                        valDir,
                        s(CONFIG.ROTULO_ARCO) + 5,
                        s(yMeters + inclinacao) + 5
                    );
                }
        }

        function desenharPrisma(ctx, s, dados) {

            const { zl, vetores } = dados;

            // Índice onde estaria o valor 0 na escala da esquerda
            const indiceZero = -vetores.FTD / zl.incHT;

            // Posição vertical correspondente
            const yTriangulo = s(indiceZero * zl.incHT);

            // ===== A EXTERNO =====
            const p = CONFIG.PRISMA.EXTERNO;

            ctx.beginPath();

            ctx.moveTo(p.TOPO.x, yTriangulo + p.TOPO.y);
            ctx.lineTo(p.ESQUERDA.x, yTriangulo + p.ESQUERDA.y);

            ctx.moveTo(p.TOPO.x, yTriangulo + p.TOPO.y);
            ctx.lineTo(p.DIREITA.x, yTriangulo + p.DIREITA.y);
            ctx.lineTo(p.ESQUERDA.x, yTriangulo + p.ESQUERDA.y);

            ctx.strokeStyle = "#b91c1c";
            ctx.lineWidth = p.BORDA;

            ctx.stroke();

            // ===== TRIÂNGULO INTERNO =====
            const pInt = CONFIG.PRISMA.INTERNO;

            ctx.beginPath();

            ctx.moveTo(pInt.TOPO.x, yTriangulo + pInt.TOPO.y);
            ctx.lineTo(pInt.ESQUERDA.x, yTriangulo + pInt.ESQUERDA.y);
            ctx.lineTo(pInt.DIREITA.x, yTriangulo + pInt.DIREITA.y);

            ctx.closePath();

            ctx.strokeStyle = "#b91c1c";
            ctx.lineWidth = 2;

            ctx.stroke();
        }

        function desenharPainelInformacoes(ctx, s, dados) {

                const {entradas, altitude, velocidade, zl, vetores} = dados;

                ctx.textAlign = 'left';
                ctx.fillStyle = '#1e293b';
                ctx.font = '13px Arial';

                let tx = s(CONFIG.PAINEL_X);
                let ty = s(CONFIG.PAINEL_Y) - 20;

                ctx.fillText(`FTD = ${vetores.FTD} m`, tx, ty);

                ctx.beginPath();
                ctx.arc(tx + 8, ty + 15, 6, 0, Math.PI * 2);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(tx + 8, ty + 15, 1.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillText(` = ${zl.incCirculo} m`, tx + 20, ty + 19);
                ctx.fillText(`5 H/T = ${zl.incHT} m`, tx, ty + 38);
                ctx.fillText(`${entradas.QNH} hPa`, tx, ty + 53);
                ctx.fillText(`+${entradas.temp}°C`, tx, ty + 68);
                ctx.fillText(`${entradas.DA} FT / ZL`, tx, ty + 83);

                // ========================
                // CORREÇÃO DO VENTO
                // ========================

                const lateral = Math.abs(dados.vento.deltaLateral).toFixed(0);
                
                const longitudinal = Math.abs(dados.vetores.FTD - dados.vento.deltaLongitudinal).toFixed(0);

                const lado = dados.vento.deltaLateral >= 0 ? "Direita" : "Esquerda";

                const posicaoLongitudinal = Math.round(dados.vetores.FTD - dados.vento.deltaLongitudinal);

                const sentido = posicaoLongitudinal >= 0 ? "Antes" : "Depois";

                ctx.font = '13px Arial';
                ctx.textAlign = 'left';

                ctx.fillText("CORREÇÃO DO VENTO", tx, ty + 105);

                ctx.fillText(`Lateral: ${lateral}m ${lado}`, tx, ty + 125);

                ctx.fillText(`Longitudinal: ${Math.abs(posicaoLongitudinal)}m ${sentido}`, tx, ty + 145);

                ctx.textAlign = 'right';
                ctx.font = 'bold 15px Arial';

                ctx.fillText( `IND. ALT = ${velocidade.indAlt} FT`, s(CONFIG.PAINEL_X) + 700, s(CONFIG.PAINEL_Y) + 20);
            }

            function desenharPontoVento(ctx, s, dados) {
                const { deltaLateral, deltaLongitudinal } = dados.vento;
                ctx.beginPath();

                ctx.arc( s(deltaLateral), -s(deltaLongitudinal), 5, 0, 2 * Math.PI);

                ctx.fillStyle = "#2563eb";
                ctx.fill();

            }

            function desenharEscalas(ctx, s) {
                desenharEscala(ctx, s, 540, "1 : 6.250", 1);
                desenharEscala(ctx, s, 610, "1 : 12.500", 2);
            }
                
        function renderizarGrafico(dados) {
            console.log(dados.vento);
            const { entradas, altitude, velocidade, balistica, zl, vetores, vetoresGrade } = dados;

            const canvas = document.getElementById('carpCanvas');
            const ctx = canvas.getContext('2d');

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const ppm = CONFIG.PIXELS_POR_METRO;
            const cx = canvas.width / 2; const cy = (canvas.height / 2) - -CONFIG.OFFSET_VERTICAL;
            ctx.translate(cx, cy);

            function s(m) { // Converte um valor da escala da esquerda para a posição Y da tela
                return m * ppm; 
            }
            
            function valorParaY(valor) {

                const valorCentral = -vetores.FTD;

                return -((valor - valorCentral) / zl.incHT) * zl.incHT;

            }
            function drawLine(x1, y1, x2, y2, color, w = 1) {
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
            }

            desenharRadiais(ctx, s, drawLine, dados);

            desenharEixoCentral(ctx, s, drawLine, dados);

            desenharGrid(ctx, s, drawLine, dados);

            desenharCirculos(ctx, s, dados);

            desenharArcos(ctx, s, valorParaY, dados);

            desenharPrisma(ctx, s, dados);

            desenharPainelInformacoes(ctx, s, dados);

            //*desenharEscalas(ctx, s);

            desenharPontoVento(ctx, s, dados);
    }

/*
   =========================
   EXPORTAÇÃO PDF
   =========================
*/
        function gerarPDF() {

            const { jsPDF } = window.jspdf;

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            const canvas = document.getElementById("carpCanvas");

            const img = canvas.toDataURL("image/png");

            const largura = 190;
            const altura = largura * canvas.height / canvas.width;

            pdf.addImage(img, "PNG", 10, 10, largura, altura);

            pdf.save("CARP.pdf");
        }
        // Rotina de Inicialização
        window.onload = function () {
            criarTabelaMAC();
            calcularTudo();
        };