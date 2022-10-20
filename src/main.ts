class main {
    constructor() {
        {
            const c = document.getElementById("previewCanvas");
            if (c == null) throw new Error("canvas not found");
            const ctx = (c as HTMLCanvasElement).getContext("2d");
            if (ctx == null) throw new Error("canvas not found");
            this.previewCanvas = ctx;
        }
        {
            const c = document.getElementById("processCanvas");
            if (c == null) throw new Error("canvas not found");
            const ctx = (c as HTMLCanvasElement).getContext("2d");
            if (ctx == null) throw new Error("canvas not found");
            this.processCanvas = ctx;
        }
        this.fileSelector = document.getElementById("fileSelector") as HTMLInputElement;
        this.fileSelector.addEventListener("change", (e) => {
            this.onFileChanged(e);
        });
    }

    previewCanvas: CanvasRenderingContext2D;
    processCanvas: CanvasRenderingContext2D;
    fileSelector: HTMLInputElement;

    private arrToNum(data: Uint8Array, start: number, length: number, isLittleEndian?: boolean): number {
        const dv = new DataView(data.slice(start, start + length).buffer);
        if (length == 2) {
            return dv.getUint16(0, isLittleEndian);
        } else if (length == 4) {
            return dv.getUint32(0, isLittleEndian);
        } else {
            return dv.getUint8(0);
        }
    }
    private parseMPO(data: Uint8Array): Blob[] {
        let head = 0;

        console.log("SOI");
        if (data[head] == 0xff && data[head + 1] == 0xd8)
            // SOI
            head += 2;
        else return [new Blob([data.buffer])]; // JPEGでない

        console.log("APP1");
        if (data[head] == 0xff && data[head + 1] == 0xe1)
            // APP1 -> skip
            head += 2 + this.arrToNum(data, head + 2, 2);

        // console.log("APP2");
        let app2Head = 0;
        let isMPF = false;
        while (!isMPF) {
            console.log("APP2");
            console.log("0x" + head.toString(16));

            if (data[head] == 0xff && data[head + 1] == 0xe2) {
                // APP2
                head += 2;
            } else return [new Blob([data.buffer])]; // JPEGだがMPOでない

            app2Head = head;
            let app2Length = this.arrToNum(data, head, 2, false);
            console.log("len", app2Length);
            head += 2; //APP2 Length

            console.log("isMPF?");

            let str = "";
            for (let i = head; i < 4 + head; i++) {
                str += String.fromCharCode(data[i]);
            }
            console.log(str);

            if (str === "MPF\0") {
                head += 4;
                isMPF = true;
            } else {
                head = app2Head + app2Length;
            }
        }
        let mpStart = head;

        let isLittleEndian = false;
        if (data[head] == 0x49) isLittleEndian = true;
        head += 4;

        let ifdOffset = this.arrToNum(data, head, 4, isLittleEndian);
        head += 4;

        head = mpStart + ifdOffset + 2;

        // 0x00 0xB0 MPFバージョン
        head += 2;
        // 形式
        head += 2;
        // 個数
        head += 4;
        // 本体
        // let version = "";
        // for (let i = head; i < 4 + head; i++) {
        //     version += String.fromCharCode(data[i]);
        // }
        // console.log(version);
        head += 4;

        // 0x01 0xB0 画像枚数
        head += 2;
        // 形式
        head += 2;
        // 個数
        head += 4;
        // 本体
        let count = this.arrToNum(data, head, 4, isLittleEndian);
        console.log(count);
        head += 4;

        // 0x02 0xB0 MPエントリ
        head += 2;
        // 形式
        head += 2;
        // console.log(this.arrToNum(data, head, 4, isLittleEndian));
        // 個数
        head += 4;
        // 本体: 4バイトを越えるのでオフセット
        let jump = this.arrToNum(data, head, 4, isLittleEndian);
        head = mpStart + jump; // MPエントリ本体へ

        let res = new Array<Blob>();
        for (let i = 0; i < count; i++) {
            // MPエントリ
            head += 4;
            let size = this.arrToNum(data, head, 4, isLittleEndian);
            head += 4;
            let offset = this.arrToNum(data, head, 4, isLittleEndian);
            head += 8;
            if (offset != 0) offset += app2Head + 6;
            console.log(i, size, offset, offset + size);
            res.push(new Blob([data.slice(offset, offset + size).buffer]));
        }

        return res;
    }

    async onFileChanged(e: Event) {
        if (this.fileSelector.files && this.fileSelector.files.length > 0) {
            const images = this.parseMPO(new Uint8Array(await this.fileSelector.files[0].arrayBuffer()));

            const img = await createImageBitmap(images[0]);
            const width = images.length == 1 ? img.width / 2 : img.width;

            this.previewCanvas.canvas.width = width;
            this.previewCanvas.canvas.height = img.height;

            if (images.length == 1) {
                this.previewCanvas.globalAlpha = 1.0;
                this.previewCanvas.drawImage(img, 0, 0, width, img.height, 0, 0, width, img.height);
                this.previewCanvas.globalAlpha = 0.5;
                this.previewCanvas.drawImage(img, width, 0, width, img.height, 0, 0, width, img.height);
            } else {
                const img2 = await createImageBitmap(images[1]);

                this.previewCanvas.globalAlpha = 1.0;
                this.previewCanvas.drawImage(img, 0, 0);
                this.previewCanvas.globalAlpha = 0.5;
                this.previewCanvas.drawImage(img2, 0, 0);
            }
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new main();
});
