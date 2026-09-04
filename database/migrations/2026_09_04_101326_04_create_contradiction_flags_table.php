<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('contradiction_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prd_version_id')->constrained()->cascadeOnDelete();
            $table->text('requirement_a');
            $table->text('requirement_b');
            $table->text('explanation');
            $table->string('resolution')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('contradiction_flags');
    }
};
